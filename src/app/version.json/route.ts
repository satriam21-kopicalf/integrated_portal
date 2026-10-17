// The build now deployed. An open (or installed) portal compares it with the build it runs (components/AppUpdate.tsx)
// and reloads when they differ. Never cached; outside the sign-in proxy (the path has a dot).
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ build: process.env.NEXT_PUBLIC_BUILD_ID }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
