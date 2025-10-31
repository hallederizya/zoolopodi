import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: !!process.env.NEXT_PUBLIC_SITE_URL,
  };

  let db = false;
  try {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data, error } = await sb.from("taxon").select("id").limit(1);
    if (!error && data) db = true;
  } catch (e) {
    db = false;
  }

  const ok = Object.values(env).every(Boolean) && db;

  return new Response(JSON.stringify({ ok, env, db, now: new Date().toISOString() }), {
    status: ok ? 200 : 500,
    headers: { "Content-Type": "application/json" },
  });
}
