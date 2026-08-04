# CoreCare Platform 1.1.0 - Windows deployment

## Use with the existing GitHub repository
1. Open GitHub Desktop.
2. Select the existing **corecare-platform** repository.
3. Choose **Repository > Show in Explorer**.
4. Make a backup copy of the current repository folder.
5. Extract this ZIP.
6. Copy the contents of the `corecare-platform` folder into the existing repository folder and choose **Replace** when Windows asks.
7. In GitHub Desktop, review the changed files but do not commit until the local checks below pass.

## Open in VS Code
In GitHub Desktop choose **Repository > Open in Visual Studio Code**.

Open **Terminal > New Terminal** in VS Code and run:

```cmd
npm install
npm run check
npm run db:migrate:remote
npm run deploy
```

If Wrangler asks you to sign in, complete the Cloudflare browser sign-in and then repeat the command.

## Commit through GitHub Desktop
After testing:
1. Return to GitHub Desktop.
2. Summary: `Add CoreCare ecosystem control centre 1.1.0`
3. Click **Commit to main**.
4. Click **Push origin**.

## Test checklist
- Sign in with the CoreCare Platform owner account.
- Confirm **Ecosystem control** appears in the left navigation.
- Confirm six product cards appear: Platform, Care, POS, Garage, Campsite & Leisure, and Finance.
- Confirm the KPI cards, ticket queue, support sessions, incidents, releases and platform staff areas load.
- Confirm CoreCare Care no longer exposes the old ecosystem owner dashboard.
- Confirm existing Command Centre, Operations, Customer Success, Revenue, Security and organisation support mode still open.

## Important
The migration creates the central product, health, ticket, support-session, incident and release tables. Product health is seeded initially. Live automatic monitoring will begin when signed health endpoints are added to each separate CoreCare product.


## Update to 1.3.0
Run `npm install`, `npm run check`, `npm run db:migrate:remote`, approve migration 0041, then run `npm run deploy`.
