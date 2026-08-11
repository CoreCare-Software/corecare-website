export async function POST() {
  return Response.json(
    { error: "CoreCare Mobile sign-in requires the Cloudflare Worker runtime." },
    { status: 503, headers: { "cache-control": "no-store" } },
  );
}
