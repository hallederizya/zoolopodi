import React from "react";

export default function ReferencesBox({ items }: { items: Array<{ citation?: string; url?: string; source?: string }> }) {
  if (!items?.length) return null;
  return (
    <section className="mt-6">
      <h2 className="font-semibold mb-2">Kaynakça</h2>
      <ul className="list-disc ml-6 text-sm">
        {items.map((r, i) => (
          <li key={i}>
            {r.url ? (
              <a className="text-blue-600 hover:underline" href={r.url} target="_blank" rel="noopener noreferrer">
                {r.citation || r.url}
              </a>
            ) : (
              r.citation || "-"
            )}
            {r.source ? <span className="text-gray-500"> — {r.source}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
