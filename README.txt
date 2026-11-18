Olaoyin Store egg-ordering app

This version requires server hosting; opening index.html directly cannot save orders.
Build: npm run build. Checks: npm test. No dependencies are required.
Sites provisions D1 using .openai/hosting.json and applies drizzle SQL migrations.
Customers receive private order links. Anyone holding a link can view that order.
Manage orders at /admin.html, signed in with the account matching ADMIN_EMAIL.
The dashboard lists the latest 500 orders. Set the total including delivery and
change the status to confirmed before the customer can pay, then tap
"Send update on WhatsApp" to message the customer their total and order link.
Customers choose a pickup/delivery date (today to 90 days ahead); "Eggs to
prepare" totals open orders by date. Private notes are never shown to customers.
An optional price list shows customers an estimate; you still set each total.
Use the Payment box to record cash or bank-transfer payments (and undo them).
Totals are locked once a payment starts or is recorded; fulfillment stays editable.

Set PAYSTACK_SECRET_KEY as a server-side secret runtime variable in Sites and
redeploy to enable online payments. Start with a test key and verify checkout
before switching to your merchant account's live key. Never put keys in JS assets.
The backend verifies the transaction reference, NGN currency and stored amount
before marking an order paid. The order page checks payment automatically when the
customer returns; Check payment remains available after checkout, including when the return redirect fails. There is no background webhook.
If initialization fails after reserving a reference, inspect Paystack before recovery
to avoid duplicate charges. No real payments are available without a merchant key.

The site's existing audience is preserved; enable public access separately if needed.
Prices, availability, and delivery are confirmed by the seller before payment.
Main WhatsApp: +2348028091950
Alternative WhatsApp: +2347066052334
