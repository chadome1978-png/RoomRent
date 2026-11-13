export function firstTrustedForwardedIp(request: Request): string | null {
  const first = request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  if (!first || first.length > 64) return null;

  if (first.includes(":")) {
    try {
      const parsed = new URL(`http://[${first}]/`);
      const host = parsed.hostname;
      if (parsed.port || !host.startsWith("[") || !host.endsWith("]")) return null;
      return host.slice(1, -1).toLowerCase();
    } catch {
      return null;
    }
  }

  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(first)) return null;
  const octets = first.split(".").map(Number);
  if (octets.some(octet => octet > 255)) return null;
  return octets.join(".");
}

export async function hmacRateLimitHash(
  secret: string,
  kind: "ip" | "username",
  value: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`roomrent-username-login:${kind}:v1\u0000${value}`),
  );
  return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, "0")).join("");
}
