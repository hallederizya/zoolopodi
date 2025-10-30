"use client";
import { useState, useEffect } from "react";

export default function SearchBox() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!q) { setResults([]); return; }
      const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      setResults(await r.json());
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="max-w-xl mx-auto">
      <input
        className="w-full border rounded px-3 py-2"
        placeholder="Tür ara (ör. vaşak, Panthera...)"
        value={q} onChange={e=>setQ(e.target.value)}
      />
      {!!results.length && (
        <ul className="border rounded mt-2">
          {results.map((it) => (
            <li key={it.id} className="p-2 hover:bg-gray-50">
              <a href={`/taxon/${it.id}`}>{it.display}</a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}