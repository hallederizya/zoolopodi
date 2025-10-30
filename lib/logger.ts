import { createClient } from "@supabase/supabase-js";

/**
 * logToSupabase – hata loglarını Supabase logs tablosuna yaz (servis rolü ile).
 * Tablo yapısı:
 * CREATE TABLE logs (
 *   id BIGSERIAL PRIMARY KEY,
 *   level TEXT,
 *   message TEXT,
 *   context JSONB,
 *   created_at TIMESTAMPTZ DEFAULT now()
 * );
 */
export async function logToSupabase(level: string, message: string, context?: any) {
  try {
    // Service-role key ile yazma yetkisi gerekebilir; yoksa anon key ile RLS açık olmalı.
    // Eğer SUPABASE_SERVICE_ROLE varsa onu kullan, yoksa ANON key kullan (dev için).
    const key = process.env.SUPABASE_SERVICE_ROLE || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);

    await supabase.from("logs").insert({
      level,
      message,
      context: context || {},
    });
  } catch (err) {
    // logToSupabase hata verirse en azından console'a düşür; sonsuz döngü olmasın.
    console.error("logToSupabase failed:", err);
  }
}
