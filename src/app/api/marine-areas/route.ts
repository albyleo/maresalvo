import { getMarineAreas } from "@/features/marine-map/data";
import { NextResponse } from "next/server";

export async function GET() {
  const areas = await getMarineAreas();
  return NextResponse.json(areas);
}
