# CoreCare Platform 1.7.2

## Authentication compatibility hotfix

- Keeps PBKDF2 password hashing at Cloudflare Workers' supported maximum of 100,000 iterations.
- Restores owner sign-in after the 1.7.1 security hardening attempted an unsupported 600,000 iterations.
- Adds a regression test that locks the production-compatible ceiling in place.
- Requires no database migration and preserves all existing accounts, passwords, sessions, and organisation data.
