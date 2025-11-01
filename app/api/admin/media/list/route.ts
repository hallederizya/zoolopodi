import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

export async function GET(req: Request) {
  try {
    // Admin token kontrolü
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    
    if (token !== process.env.ADMIN_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit") || "50"), 100);
    const offset = Number(url.searchParams.get("offset") || "0");
    const showAll = url.searchParams.get("showAll") === "true";

    let query = supabase
      .from("media")
      .select("*, taxon:taxon_id(canonical_name)", { count: "exact" })
      .order("id", { ascending: false })
      .range(offset, offset + limit - 1);

    // Varsayılan: sadece onaylanmamışları göster
    if (!showAll) {
      query = query.or("approved.is.null,approved.eq.false");
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("[Admin] Media list error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      data: data || [], 
      count: count || 0,
      limit,
      offset 
    });
  } catch (e: any) {
    console.error("[Admin] Media list error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
