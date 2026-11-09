# RoomRent: Supabase storage for rental rooms

The RoomRent room screen now calls this Supabase data layer for sign-in, room reads, inserts, edits, and occupancy-status changes when build-time configuration is present. Until the owner configures a Supabase project and rebuilds/redeploys the static PWA, no Supabase connection is active. Existing `localStorage` room data is never uploaded automatically.

## 1. Create the table and security policies

1. Create a Supabase project.
2. Open **SQL Editor** and run [`../supabase/rental_rooms.sql`](../supabase/rental_rooms.sql).
3. In Supabase Authentication, enable email/password sign-in and choose whether email confirmation is required.
4. Keep RLS enabled. Policies scope every read/write to `auth.uid() = owner_id`; never create an anonymous/public policy for rental records.
5. Add the production `pages.dev` URL and any development/Preview origin you actually use to the Supabase Auth URL Configuration allowlist. Restrict redirect URLs to trusted origins.

## 2. Configure public browser values

Copy the project URL and **publishable/anon key** from Supabase Project Settings → API to a local `.env` file:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
```

Restart Vite after editing `.env`; for production, provide these build-time values to the static build environment and rebuild/redeploy. `VITE_*` variables are bundled into publicly downloadable JavaScript. This is expected only for the publishable/anon key with RLS correctly configured. **Never use `service_role` or a secret key in the browser or any `VITE_*` variable.** Do not commit `.env`; only the placeholder `.env.example` belongs in source control.

## 3. Call the room data layer

Module: `client/src/components/roomrent/supabaseRooms.ts`.

```ts
import {
  createSupabaseRoom,
  fetchSupabaseRooms,
  getSupabaseRoomUser,
  signInToSupabaseRooms,
  signOutFromSupabaseRooms,
  updateSupabaseRoom,
} from "./supabaseRooms";

// Sign in an account that already exists in Supabase Auth.
await signInToSupabaseRooms(email, password);
const user = await getSupabaseRoomUser();

// Read only rows allowed by this account's RLS policies.
const rooms = await fetchSupabaseRooms();

// Create: use the returned server-assigned ID for invoice.roomId.
const created = await createSupabaseRoom({
  roomNumber: "A-01",
  tenantName: "ตัวอย่างผู้เช่า",
  phone: "",
  rentAmount: 4500,
  waterRate: 18,
  electricRate: 8,
  status: "occupied",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

// Update an existing room. RLS rejects another owner's row.
const updated = await updateSupabaseRoom({ ...created, rentAmount: 4700 });
await signOutFromSupabaseRooms();
```

Handle rejected promises in the calling UI and show a user-friendly network/auth error. Do not log passwords, access tokens, room payloads, tenant names, phone numbers, or Supabase response bodies to analytics/debug logs. Use `onSupabaseRoomAuthChange` to keep auth UI synchronized and unsubscribe on unmount.

## App behavior and local-room migration

Open **ห้องพัก** in RoomRent to see the Supabase account panel. If configuration is missing, the panel explains which build variables are needed. If configured, owners can sign in or create an email/password account; email confirmation follows the Supabase Auth project's setting. Once signed in, the app loads rooms through RLS and sends create/edit/occupancy changes to Supabase. A cloud failure does not silently fall back to stale local room records.

If local rooms exist and the signed-in user's Supabase table is empty, the **นำเข้าห้องเดิม** action offers an explicit confirmation naming the number of rooms and account. It inserts the rows as one bulk operation, maps old room IDs to the new Supabase IDs in on-device invoice records, then removes the migrated room copies from local storage. It never merges automatically into a non-empty Supabase account; reconcile those records manually first. Back up the local app before migration. Bills, expenses, PromptPay settings, and their backup data remain local; they are not uploaded by room CRUD.

The entire static PWA still needs an internet connection for Supabase authentication and room data; offline app-shell support remains, but cloud rooms cannot be fetched or saved offline. Avoid logging tenant details or credentials.


## Test Login/Logout

For the manual signup, email-confirmation, session-persistence, logout, and RLS-isolation checklist, see [Supabase Auth test guide](./supabase-auth-test-guide.md).


## Local `.env` and static build

Vite reads `.env` from the repository root (`envDir` is the project root). Start from the safe template:

```sh
cp .env.example .env
```

Edit these two lines in `.env` using values from **Supabase Dashboard → Project Settings → API**:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
```

Use the publishable key (`sb_publishable_...`) or a legacy anon key, never a service-role/secret key. `.env` is ignored by Git and must not be added to a deployment archive. Restart the dev server after editing; for a static production release, run `pnpm build:static` with `.env` present, then upload only `dist/public`. The current Cloudflare Pages Direct Upload does not run Vite itself, so setting an environment variable only in Cloudflare will not rewrite an already-built JavaScript bundle. Vite `VITE_*` values are public in the browser; RLS is the database security boundary.
