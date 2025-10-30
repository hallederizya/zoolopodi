import React from "react";

export default async function Head({ params }: { params: { id: string } }) {
  try {
    const id = params.id;
    const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/api/taxon/${id}`, { cache: "no-store" });
    if (!res.ok) {
      return (
        <>
          <meta property="og:type" content="article" />
        </>
      );
    }
    const data = await res.json();
    const title = data?.taxon?.canonical_name || `Taxon ${id}`;
    const desc = data?.names?.find((n: any) => !n.is_scientific)?.name || data?.taxon?.rank || "";
    const image = data?.media?.[0]?.url || "";
    const url = (process.env.NEXT_PUBLIC_SITE_URL ?? "") + `/taxon/${id}`;

    return (
      <>
        <meta property="og:type" content="article" />
        <meta property="og:title" content={title} />
        {desc ? <meta property="og:description" content={desc} /> : null}
        {image ? <meta property="og:image" content={image} /> : null}
        <meta property="og:url" content={url} />
      </>
    );
  } catch (err) {
    return (
      <>
        <meta property="og:type" content="article" />
      </>
    );
  }
}
