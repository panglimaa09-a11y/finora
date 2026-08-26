// Provider-neutral payment adapter boundary.
export type TopupRequest = { amount:number; method:'qris'|'va'|'bank_transfer'; reference:string };
export type TopupResponse = { provider:string; provider_reference:string; payment_url?:string; qr_string?:string; expires_at?:string };
export interface PaymentAdapter {
  createTopup(input: TopupRequest): Promise<TopupResponse>;
  createPayout(input:{amount:number; bank_code:string; account_number:string; account_name:string; reference:string}): Promise<{provider:string; provider_reference:string}>;
  verifyWebhook(req:Request, rawBody:string): Promise<Record<string,unknown>>;
}
export function configuredProvider(){ const provider=Deno.env.get('PAYMENT_PROVIDER'); if(!provider) throw new Error('PAYMENT_PROVIDER_NOT_CONFIGURED'); return provider; }
