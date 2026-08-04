# Install CoreCare Platform 1.4.3

Extract the update into the CoreCare Platform repository and replace the destination files.

From Windows CMD in the CoreCare Platform repository, run:

```cmd
npm.cmd install
npm.cmd run check
npx.cmd wrangler deploy
```

No database migration is required. Do not delete, recreate, or clear either support-session table.
