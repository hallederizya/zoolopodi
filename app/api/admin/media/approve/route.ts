import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

export async function POST(req: Request) {
  try {
    // Admin token kontrolü
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    
    if (token !== process.env.ADMIN_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, approved } = await req.json();
    
    if (!id || typeof approved !== "boolean") {
      return NextResponse.json({ error: "id and approved (boolean) required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("media")
      .update({ approved })
      .eq("id", id);

    if (error) {
      console.error("[Admin] Media approve error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id, approved });
  } catch (e: any) {
    console.error("[Admin] Media approve error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
