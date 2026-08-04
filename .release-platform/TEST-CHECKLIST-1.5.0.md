# CoreCare Platform 1.5.0 test checklist

- [ ] Sign in as a platform owner and open a product monitor.
- [ ] Configure the product's HTTPS production URL and save it.
- [ ] Connect an existing organisation to the product.
- [ ] Create a new organisation from the product monitor and confirm it appears only once.
- [ ] Open Monitor for a connected organisation and confirm operations and support history load.
- [ ] Start support access with a reason and confirm the product opens in a new tab.
- [ ] Confirm the receiving product exchanges the launch code once and enters the correct organisation.
- [ ] Reusing the launch code returns HTTP 410.
- [ ] Ending an unconsumed support session revokes its launch grant.
- [ ] Confirm product creation, configuration, organisation linking, session start and session end appear in audit history.
