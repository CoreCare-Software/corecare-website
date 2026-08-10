// The deployed Worker intercepts this path and calls Platform through the
// private PortalBroker binding. The app-router fallback must fail closed.
const PRODUCT_HANDOFF_PATH = "/auth/portal-login";
export async function POST() {
  return Response.json({
    error: "CoreCare one-login requires the Cloudflare Worker runtime.",
    handoffPath: PRODUCT_HANDOFF_PATH,
  }, { status: 503, headers: { "cache-control": "no-store" } });
}
