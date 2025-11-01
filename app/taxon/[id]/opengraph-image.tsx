/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from "@vercel/og";
import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";      // hızlı
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OG({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

  const [{ data: tx }, { data: pic }] = await Promise.all([
    sb.from("taxon").select("canonical_name, rank").eq("id", id).single(),
    sb.from("media").select("url, title").eq("taxon_id", id).eq("kind","image").eq("approved", true).order("id",{ascending:true}).limit(1).maybeSingle()
  ]);

  const title = tx?.canonical_name || "Zoolopodi";
  const img = pic?.url;

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          background: "#0b0b0b",
          color: "white",
          position: "relative",
          padding: "40px"
        }}
      >
        {img ? (
          <img
            alt={title}
            src={img}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: 0.5
            }}
          />
        ) : null}
        <div style={{ display: "flex", flexDirection: "column", position: "relative", zIndex: "1" }}>
          <div style={{ display: "flex", fontSize: 54, fontWeight: 800, lineHeight: 1.1 }}>{title}</div>
          <div style={{ display: "flex", marginTop: 8, fontSize: 24, opacity: 0.85 }}>Zoolopodi • {tx?.rank?.toUpperCase() || "SPECIMEN"}</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
