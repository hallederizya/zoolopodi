export async function GET() {
  const body = `User-agent: *\nAllow: /\nSitemap: ${process.env.NEXT_PUBLIC_SITE_URL}/sitemap.xml`;
  return new Response(body, { headers: { "Content-Type": "text/plain" } });
}
