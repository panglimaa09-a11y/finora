# FINORA Production Wallet V3

FINORA is a production-oriented wallet application foundation. It is intentionally **fail-closed**: no client action can credit wallet balance. Real funds must be processed through a properly contracted/licensed payment provider/PJP and verified server-side webhooks.

## Included
- Google, Facebook and Apple OAuth via Supabase Auth
- Wallet + available/pending balance
- Server-side withdrawal transaction with atomic balance reservation
- Double-entry-style ledger entries
- Top-up order lifecycle
- Provider-neutral payment adapter boundary
- Webhook event deduplication
- RLS policies
- Security/audit foundation
- Responsive UI for phone/tablet/desktop

## Setup
1. Create a Supabase project.
2. Enable Google, Facebook and Apple providers in Supabase Auth.
3. Run `supabase.sql` in Supabase SQL Editor.
4. Copy `.env.example` to `.env` and fill Vite values.
5. `npm install && npm run dev`.
6. Deploy Edge Functions and configure server-side secrets:
   - `PAYMENT_PROVIDER`
   - `PAYMENT_PROVIDER_API_KEY`
   - `PAYMENT_WEBHOOK_SECRET`
   - `SUPABASE_SERVICE_ROLE_KEY`
7. Implement the selected provider's API/signature verification inside the payment adapter before production use.

## Important production boundary
This repository does not contain fake payment success, fake provider credentials, or a browser-controlled balance. A top-up becomes available only after a verified provider webhook posts it through the server-side ledger function.

For Indonesia, the payment/custody model must be structured with an appropriately licensed/authorized payment service provider and comply with applicable Bank Indonesia requirements before accepting public funds.
