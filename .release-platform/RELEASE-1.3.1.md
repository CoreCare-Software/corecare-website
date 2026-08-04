# CoreCare Platform 1.3.1

Focused stability fix for the owner and support portal.

## Fixed
- Added the missing `formatDateTime` browser helper.
- Prevents the global `formatDateTime is not defined` error.
- Restores rendering of ticket dates, support-session expiry times, incident dates, organisation activity and support history.

## Database
No migration is required.

## Dependencies
This patch does not include or alter `package-lock.json`.
