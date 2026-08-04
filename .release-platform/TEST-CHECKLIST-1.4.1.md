# CoreCare Platform 1.4.1 test checklist

1. Confirm the displayed version is 1.4.1.
2. Open Tickets and check whether the earlier failed test ticket already exists.
3. Click + New ticket and create a clearly named test ticket.
4. Confirm the button changes to Creating… while saving.
5. Confirm a green success message shows the new ticket number.
6. Confirm the dialog closes and the new ticket appears in the queue without refreshing.
7. Open the new ticket and confirm product, organisation, description, category and priority are correct.
8. Refresh the browser and confirm the ticket remains.
9. Check Audit Log for platform.ticket.created.
10. Submit a blank/invalid form and confirm browser validation prevents submission.
11. Confirm no red Console error says showToast or writeAudit is not defined.
12. Open Executive Dashboard and each sidebar page to confirm no regression.
