"use client";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";

type SearchItem = {
  id: number;
  display: string;
  canonical: string;
  rank: string;
  thumb?: string | null;
};

export default function SearchBox({ placeholderKey = "search.placeholder" }: { placeholderKey?: string }) {
  const t = useTranslations();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!q) { setResults([]); return; }
      setLoading(true);
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const j = await r.json();
        setResults(j);
      } catch (e) {
        console.warn("Search error", e);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex gap-2">
        <input
          className="w-full border rounded px-3 py-2"
          placeholder={t(placeholderKey)}
          value={q} onChange={e=>setQ(e.target.value)}
        />
      </div>

      {loading && <div className="mt-2 text-sm text-gray-500">Aranıyor…</div>}

      {!!results.length && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
          {results.map((it) => (
            <a key={it.id} href={`/taxon/${it.id}`} className="border rounded overflow-hidden hover:shadow">
              {it.thumb ? (
                <img src={it.thumb} alt={it.canonical} className="w-full h-32 object-cover" />
              ) : (
                <div className="w-full h-32 bg-gray-100 flex items-center justify-center text-gray-400 text-sm">
                  Görsel yok
                </div>
              )}
              <div className="p-2">
                <div className="font-medium text-sm line-clamp-2">{it.display}</div>
                <div className="text-xs text-gray-500">{it.rank}</div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}