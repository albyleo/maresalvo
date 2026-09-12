import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { isSupabaseConfigured } from '@/lib/supabase/config';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = '/dashboard/qualifiche';

  if (code && isSupabaseConfigured()) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(new URL('/login?error=confirmation', origin));
  } else {
    return NextResponse.redirect(new URL('/login?error=confirmation', origin));
  }

  return NextResponse.redirect(`${origin}${next}`);
}
