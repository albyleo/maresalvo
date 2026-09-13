import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) { console.log('Supabase URL or public key missing.'); process.exit(1); }
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
// Read-only call with an invented code. No user records are logged or modified.
const { error, status } = await client.rpc('verify_certificate', { p_code: 'maresalvo-connection-check' });
if (error) { console.log(JSON.stringify({ connection: 'failed', status, code: error.code || 'network_error' })); process.exit(1); }
console.log(JSON.stringify({ connection: 'ok', certificate_verification_rpc: 'available', status }));
