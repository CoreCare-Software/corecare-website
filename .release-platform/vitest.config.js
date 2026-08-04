import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        serviceBindings: Object.fromEntries(
          ['CORECARE_CARE','CORECARE_POS','CORECARE_GARAGE','CORECARE_CAMPSITE','CORECARE_FINANCE'].map(binding=>[
            binding,
            () => new Response(JSON.stringify({ ok: true, status: 'healthy', testBinding: binding }), { headers: { 'content-type': 'application/json' } }),
          ]),
        ),
      },
    }),
  ],
  test: {
    include: ['test/runtime/**/*.vitest.js'],
    testTimeout: 15000,
  },
});
