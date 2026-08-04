# Update CoreCare Platform to 1.2.0

1. Close any running development server.
2. Copy the contents of this project into your existing `corecare-platform` repository and replace matching files.
3. Open the repository in VS Code.
4. Run:

```cmd
npm install
npm run check
npm run db:migrate:remote
npm run deploy
```

When the migration asks whether to continue, type `y` and press Enter.

After deployment, press `Ctrl + F5` in the browser.

## Expected navigation

- Executive Dashboard
- Tickets
- Active Support Sessions
- Incidents
- CoreCare Care
- CoreCare Garage
- CoreCare POS
- CoreCare Campsite
- CoreCare Finance
- CoreCare Platform
- CoreCare Staff
- Audit Log
- Platform Settings

Migration `0039_simplified_owner_support_portal.sql` creates the product-to-organisation monitoring link and initially links existing organisations to CoreCare Care.
