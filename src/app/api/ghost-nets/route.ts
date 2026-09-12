import { NextResponse } from "next/server";
import { z } from "zod";
import { getGhostNets } from "@/features/marine-map/data";
import { isSupabaseConfigured } from '@/lib/supabase/config';

export async function GET() {
  const reports = await getGhostNets();
  return NextResponse.json(reports);
}

const reportSchema = z.object({
  gear_type: z.enum(["net", "longline", "trap", "rope", "other"]),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  depth_m: z.number().int().nonnegative().nullable().optional(),
  description: z.string().max(1000).nullable().optional(),
  photo_url: z.string().url().nullable().optional(),
  contact_info: z.string().max(200).nullable().optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON non valido" }, { status: 400 });
  }

  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dati non validi", issues: parsed.error.flatten() },
      { status: 422 }
    );
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: 'Segnalazioni non ancora disponibili. Nessun dato è stato salvato.' },
      { status: 503 }
    );
  }

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("ghost_net_reports")
    .insert({ ...parsed.data, reporter_id: user?.id ?? null });

  if (error) {
    return NextResponse.json({ error: 'Salvataggio non riuscito. Riprova.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
