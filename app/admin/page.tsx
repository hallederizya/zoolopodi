"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function AdminPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      // Token yoksa, kullanıcıdan iste
      const userToken = prompt("Admin token giriniz:");
      if (userToken) {
        router.push(`/admin?token=${userToken}`);
      } else {
        router.push("/");
      }
    } else {
      setLoading(false);
    }
  }, [searchParams, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Yükleniyor...</p>
      </div>
    );
  }

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Admin Panel</h1>
      
      <div className="grid gap-4">
        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Takson Yönetimi</h2>
          <ul className="space-y-2">
            <li>
              <a href="/admin/taxa" className="text-blue-600 hover:underline">
                Tüm Taksonları Görüntüle
              </a>
            </li>
            <li>
              <a href="/admin/search" className="text-blue-600 hover:underline">
                Takson Ara
              </a>
            </li>
          </ul>
        </section>

        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Medya Yönetimi</h2>
          <ul className="space-y-2">
            <li>
              <a 
                href={`/admin/media?token=${searchParams.get("token")}`} 
                className="text-blue-600 hover:underline"
              >
                Medya Onay/Reddet
              </a>
            </li>
          </ul>
        </section>

        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">İstatistikler</h2>
          <p className="text-gray-600">Yakında...</p>
        </section>

        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Ayarlar</h2>
          <p className="text-gray-600">Yakında...</p>
        </section>
      </div>
      <div className="mt-6 border-t pt-4">
        <h2 className="font-semibold mb-2">Kaynakça ekle</h2>
        <RefForm />
      </div>
    </main>
  );
}

function RefForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [taxonId, setTaxonId] = useState("");
  const [citation, setCitation] = useState("");
  const [url, setUrl] = useState("");
  const [source, setSource] = useState("");

  async function submit() {
    try {
      if (!token) throw new Error("Admin token missing");
      const res = await fetch(`/api/admin/refs/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ taxon_id: Number(taxonId), citation, url, source }),
      });
      if (!res.ok) throw new Error("insert failed");
      alert("Eklendi!");
      setCitation(""); setUrl(""); setSource(""); setTaxonId("");
    } catch (e: any) { alert("Hata: " + (e?.message || String(e))); }
  }

  return (
    <div className="grid gap-2 max-w-xl">
      <input className="border rounded px-3 py-2" placeholder="taxon_id" value={taxonId} onChange={e=>setTaxonId(e.target.value)} />
      <input className="border rounded px-3 py-2" placeholder="citation (örn: Smith 2021, Journal...)" value={citation} onChange={e=>setCitation(e.target.value)} />
      <input className="border rounded px-3 py-2" placeholder="url" value={url} onChange={e=>setUrl(e.target.value)} />
      <input className="border rounded px-3 py-2" placeholder="source (örn: EOL / makale)" value={source} onChange={e=>setSource(e.target.value)} />
      <button onClick={submit} className="px-3 py-2 rounded border w-fit">Ekle</button>
    </div>
  );
}
