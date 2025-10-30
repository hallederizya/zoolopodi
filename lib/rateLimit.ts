/**
 * rateLimit.ts – Basit in-memory IP-based rate limiting.
 * Redis yok ise bu Map kullanılır; production'da Vercel KV / Upstash / Redis önerilir.
 * Her IP için son 1 dakika içindeki istek sayısı tutulur.
 */

type BucketEntry = { count: number; resetAt: number };
const buckets = new Map<string, BucketEntry>();

// Temizleme: 2 dakikadan eski bucket'ları sil (memory leak önleme)
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of buckets.entries()) {
    if (entry.resetAt < now - 120_000) buckets.delete(ip);
  }
}, 60_000);

export function checkRateLimit(ip: string, maxRequests = 20, windowMs = 60_000): { allowed: boolean; remaining: number } {
  const now = Date.now();
  let entry = buckets.get(ip);

  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + windowMs };
    buckets.set(ip, entry);
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count };
}
