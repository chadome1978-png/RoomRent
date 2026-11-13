// @ts-ignore Supabase Edge Runtime resolves npm: imports; the browser TypeScript LSP does not.
import { createClient } from "npm:@supabase/supabase-js@2";
import { firstTrustedForwardedIp, hmacRateLimitHash } from "./rateLimit.ts";

const edgeRuntime = globalThis as typeof globalThis & {
  Deno: {
    env: { get(name: string): string | undefined };
    serve(handler: (request: Request) => Response | Promise<Response>): void;
  };
};

const allowedOrigins = new Set([
  "https://roomrent-local-pwa.pages.dev",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

const responseHeaders = (origin: string) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
});

edgeRuntime.Deno.serve(async (request) => {
  const origin = request.headers.get("origin") ?? "";
  if (!allowedOrigins.has(origin)) {
    return new Response(JSON.stringify({ error: "คำขอไม่ถูกต้อง" }), {
      status: 403,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }

  const headers = {
    ...responseHeaders(origin),
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };
  const json = (body: unknown, status = 200, extraHeaders: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), { status, headers: { ...headers, ...extraHeaders } });

  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return json({ error: "คำขอไม่ถูกต้อง" }, 405);

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 4096) return json({ error: "คำขอไม่ถูกต้อง" }, 413);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, 400);
  }

  if (!body || typeof body !== "object") {
    return json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, 400);
  }
  const { username, password } = body as Record<string, unknown>;
  if (
    typeof username !== "string" ||
    typeof password !== "string" ||
    !/^[a-zA-Z0-9_]{3,32}$/.test(username) ||
    password.length < 1 ||
    password.length > 256
  ) {
    return json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, 400);
  }

  const supabaseUrl = edgeRuntime.Deno.env.get("SUPABASE_URL");
  const anonKey = edgeRuntime.Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = edgeRuntime.Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    // Do not log environment values or request bodies.
    return json({ error: "ระบบเข้าสู่ระบบยังไม่พร้อมใช้งาน" }, 503);
  }

  const clientIp = firstTrustedForwardedIp(request);
  if (!clientIp) return json({ error: "ระบบเข้าสู่ระบบไม่พร้อมใช้งาน" }, 503);

  try {
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const normalizedUsername = username.toLowerCase();
    const [ipHash, usernameHash] = await Promise.all([
      hmacRateLimitHash(serviceRoleKey, "ip", clientIp),
      hmacRateLimitHash(serviceRoleKey, "username", normalizedUsername),
    ]);
    const { data: rateLimitRows, error: rateLimitError } = await admin.rpc(
      "consume_roomrent_username_login_rate_limit",
      { p_ip_hash: ipHash, p_username_hash: usernameHash },
    );
    const rateLimit = Array.isArray(rateLimitRows) ? rateLimitRows[0] : null;
    if (
      rateLimitError ||
      !rateLimit ||
      typeof rateLimit.allowed !== "boolean" ||
      typeof rateLimit.retry_after_seconds !== "number"
    ) {
      return json({ error: "ระบบเข้าสู่ระบบไม่พร้อมใช้งาน" }, 503);
    }
    if (!rateLimit.allowed) {
      const retryAfter = Math.max(1, Math.min(900, Math.ceil(rateLimit.retry_after_seconds)));
      return json(
        { error: "เข้าสู่ระบบถี่เกินไป กรุณารอสักครู่แล้วลองใหม่" },
        429,
        { "Retry-After": String(retryAfter) },
      );
    }

    const { data: mapping, error: mappingError } = await admin
      .from("login_names")
      .select("user_id")
      .eq("username", normalizedUsername)
      .maybeSingle();

    if (mappingError || !mapping) {
      return json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, 401);
    }

    const { data: authUser, error: userLookupError } =
      await admin.auth.admin.getUserById(mapping.user_id);
    const email = authUser.user?.email;
    if (userLookupError || !email) {
      return json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, 401);
    }

    // Supabase Auth remains the only verifier of passwords and issuer of sessions.
    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: signInData, error: signInError } =
      await authClient.auth.signInWithPassword({ email, password });
    if (signInError || !signInData.session) {
      return json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" }, 401);
    }

    return json({
      access_token: signInData.session.access_token,
      refresh_token: signInData.session.refresh_token,
    });
  } catch {
    // Never log passwords, emails, tokens, tenant data, or raw request bodies.
    return json({ error: "เข้าสู่ระบบไม่สำเร็จ โปรดลองอีกครั้ง" }, 503);
  }
});
