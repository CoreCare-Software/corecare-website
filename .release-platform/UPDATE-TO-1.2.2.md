# Update to CoreCare Platform 1.2.2

Copy these changed files into the existing `corecare-platform` repository and replace matching files. This package intentionally excludes `package-lock.json`.

Run:

```cmd
npm install
npm run check
npm run db:migrate:remote
npm run deploy
```

Answer `y` when Wrangler asks to apply migration 0040. Then refresh with Ctrl+F5.
