import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Debug endpoint to check media queries
export async function GET(req: Request) {
  const url = new URL(req.url);
  const taxonId = url.searchParams.get("taxonId");
  
  if (!taxonId) {
    return NextResponse.json({ error: "taxonId parameter required" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const supabaseService = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE!
  );

  const id = Number(taxonId);

  // Test 1: All media (no filter)
  const { data: allMedia, error: allMediaErr } = await supabase
    .from("media")
    .select("*")
    .eq("taxon_id", id);

  // Test 2: Only approved media
  const { data: approvedMedia, error: approvedErr } = await supabase
    .from("media")
    .select("*")
    .eq("taxon_id", id)
    .eq("approved", true);

  // Test 3: With service role (bypass RLS)
  const { data: serviceMedia, error: serviceErr } = await supabaseService
    .from("media")
    .select("*")
    .eq("taxon_id", id);

  // Test 4: Count all media for this taxon
  const { count: totalCount } = await supabaseService
    .from("media")
    .select("*", { count: "exact", head: true })
    .eq("taxon_id", id);

  // Test 5: Count approved media
  const { count: approvedCount } = await supabaseService
    .from("media")
    .select("*", { count: "exact", head: true })
    .eq("taxon_id", id)
    .eq("approved", true);

  return NextResponse.json({
    taxonId: id,
    tests: {
      allMedia: {
        count: allMedia?.length || 0,
        error: allMediaErr?.message || null,
        sample: allMedia?.[0] || null
      },
      approvedMedia: {
        count: approvedMedia?.length || 0,
        error: approvedErr?.message || null,
        sample: approvedMedia?.[0] || null
      },
      serviceRole: {
        count: serviceMedia?.length || 0,
        error: serviceErr?.message || null,
        sample: serviceMedia?.[0] || null
      },
      counts: {
        total: totalCount || 0,
        approved: approvedCount || 0,
        unapproved: (totalCount || 0) - (approvedCount || 0)
      }
    },
    diagnosis: {
      hasMedia: (totalCount || 0) > 0,
      hasApproved: (approvedCount || 0) > 0,
      rlsBlocking: allMediaErr !== null,
      needsApproval: (totalCount || 0) > (approvedCount || 0)
    }
  });
}
