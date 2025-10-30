"use client";
import { useState } from "react";

async function callAdmin(path: string, opts: any = {}) {
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const headers: any = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  const r = await fetch(path, { ...opts, headers });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export default function AdminPage() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState<number | null>(null);

  async function search() {
    const j = await callAdmin(`/api/admin/search?q=${encodeURIComponent(q)}`);
    setItems(j);
  }

  async function rebuild(id: number) {
    setBusy(id);
    try {
      const j = await callAdmin("/api/admin/rebuild", { method: "POST", body: JSON.stringify({ id }) });
      alert(`IUCN: ${j.iucn || j.iucn_error || "-"}\nCommons: ${JSON.stringify(j.commons) || j.commons_error || "-"}\niNat: ${j.inat || j.inat_error || "-"}`);
    } catch (e:any) {
      alert("Hata: " + e.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Zoolopodi — Admin</h1>

      <div className="flex gap-2">
        <input className="border rounded px-3 py-2 w-full" value={q} onChange={e=>setQ(e.target.value)} placeholder="Tür ara..." />
        <button className="px-3 py-2 rounded bg-black text-white" onClick={search}>Ara</button>
      </div>

      <div className="mt-4 grid gap-2">
        {items.map((it) => (
          <div key={it.id} className="border rounded p-3 flex items-center justify-between">
            <div>
              <div className="font-medium">#{it.id} — {it.canonical}</div>
            </div>
            <div className="flex gap-2">
              <button disabled={busy===it.id} onClick={()=>rebuild(it.id)} className="px-3 py-1 rounded border">
                {busy===it.id ? "İşleniyor..." : "Rebuild (IUCN+Commons+iNat)"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
