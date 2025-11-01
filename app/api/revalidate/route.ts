import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export async function POST(req: Request) {
  try {
    // Admin token kontrolü (güvenlik için)
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    
    if (token !== process.env.ADMIN_TOKEN) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { path, tag } = await req.json().catch(() => ({}));
    
    if (!path && !tag) {
      return NextResponse.json({ ok: false, error: "path or tag required" }, { status: 400 });
    }

    // Path-based revalidation
    if (path) {
      revalidatePath(path);
      console.log(`[Revalidate] Path: ${path}`);
    }

    return NextResponse.json({ 
      ok: true, 
      revalidated: true,
      path,
      timestamp: new Date().toISOString() 
    });
  } catch (e: any) {
    console.error("[Revalidate] Error:", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
