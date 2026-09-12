import VerificationForm from '@/features/certification/VerificationForm';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import type { CertificateVerification } from '@/types';

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const params = await searchParams;
  const code = typeof params.code === 'string' ? params.code : '';
  let result: CertificateVerification | null = null;
  let error = '';
  if (code) {
    if (!/^[a-zA-Z0-9-]{8,64}$/.test(code)) error = 'Codice non valido.';
    else if (!isSupabaseConfigured()) error = 'Verifica temporaneamente non disponibile.';
    else {
      const supabase = await createClient();
      const response = await supabase.rpc('verify_certificate', { p_code: code });
      if (response.error) error = 'Verifica temporaneamente non disponibile.';
      else if (!response.data?.length) error = 'Certificato non trovato.';
      else result = response.data[0];
    }
  }
  return <VerificationForm key={code} initialCode={code} initialResult={result} initialError={error} />;
}
