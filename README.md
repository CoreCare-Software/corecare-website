# CoreCare Systems website

The public showcase, unified product login entry point, trial journey and enquiry service for the CoreCare product family.

## What is included

- Product showcase and representative demonstrations
- Product-specific landing pages
- One login entry point that checks credentials with the real products
- 30-day trial requests whose clock begins at workspace activation
- Durable trial, contact and first-party service-event records in D1
- Privacy, cookie, website terms and security information
- SEO routes, structured data, branded error handling and production security headers

## Local development

Requires Node.js 22.13 or later.

```bash
npm install
npm run dev
```

Copy `.env.example` to an ignored local environment file when testing optional automation or alternate product origins. Never commit secrets.

## Validation

```bash
npm run lint
npm test
```

The production site is published through OpenAI Sites using `.openai/hosting.json`. D1 schema changes live in `drizzle/` and are packaged with each saved site version.
