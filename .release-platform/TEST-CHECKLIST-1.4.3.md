# CoreCare Platform 1.4.3 test checklist

1. Sign in to CoreCare Platform as a platform user.
2. Open an organisation monitor and start an audited support session.
3. Confirm the request returns HTTP 201 rather than HTTP 500 and the success message appears.
4. Confirm the new session appears once in Support history with the selected mode, reason, staff member, and expiry.
5. End the session and confirm it changes from active to ended without HTTP 500.
6. Refresh the page and confirm the session remains in history.
7. Open Support Tickets and confirm existing tickets, messages, attachments, and time entries still appear.
8. Confirm an audit entry exists for starting and ending the support session.
