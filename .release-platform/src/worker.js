export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/health') {
      return Response.json({ status: 'ok', service: 'corecare-platform', version: '0.1.0', timestamp: new Date().toISOString() });
    }
    return env.ASSETS.fetch(request);
  },
};
