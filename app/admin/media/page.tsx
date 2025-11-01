"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";

type MediaItem = {
  id: number;
  taxon_id: number;
  url: string;
  thumb_url?: string;
  title?: string;
  author?: string;
  license?: string;
  source?: string;
  approved: boolean | null;
  taxon?: { canonical_name: string };
};

export default function AdminMediaPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!token) {
      const userToken = prompt("Admin token giriniz:");
      if (userToken) {
        window.location.href = `/admin/media?token=${userToken}`;
      } else {
        window.location.href = "/";
      }
      return;
    }
    loadMedia();
  }, [token, showAll]);

  async function loadMedia() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/media/list?showAll=${showAll}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load media");
      const json = await res.json();
      setMedia(json.data || []);
      setCount(json.count || 0);
    } catch (e) {
      console.error(e);
      alert("Medya yüklenemedi");
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(id: number, approved: boolean) {
    try {
      const res = await fetch("/api/admin/media/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id, approved }),
      });
      if (!res.ok) throw new Error("Failed to approve");
      alert(approved ? "Onaylandı!" : "Reddedildi!");
      loadMedia();
    } catch (e) {
      console.error(e);
      alert("Hata oluştu");
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Bu görseli silmek istediğinize emin misiniz?")) return;
    try {
      const res = await fetch("/api/admin/media/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error("Failed to delete");
      alert("Silindi!");
      loadMedia();
    } catch (e) {
      console.error(e);
      alert("Hata oluştu");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Yükleniyor...</p>
      </div>
    );
  }

  return (
    <main className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-4">Medya Yönetimi</h1>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
            />
            <span>Tüm medyaları göster ({count} toplam)</span>
          </label>
          <a href={`/admin?token=${token}`} className="text-blue-600 hover:underline">
            ← Admin Panele Dön
          </a>
        </div>
      </div>

      {media.length === 0 ? (
        <p className="text-gray-600">
          {showAll ? "Hiç medya yok" : "Onay bekleyen medya yok"}
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {media.map((item) => (
            <div key={item.id} className="border rounded-lg p-4 bg-white shadow">
              <div className="relative w-full h-48 mb-3 bg-gray-100 rounded">
                <Image
                  src={item.thumb_url || item.url}
                  alt={item.title || "Media"}
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>
              
              <div className="space-y-2 text-sm">
                <div>
                  <strong>Tür:</strong>{" "}
                  <a
                    href={`/taxon/${item.taxon_id}`}
                    target="_blank"
                    className="text-blue-600 hover:underline"
                  >
                    {item.taxon?.canonical_name || `ID: ${item.taxon_id}`}
                  </a>
                </div>
                {item.title && (
                  <div>
                    <strong>Başlık:</strong> {item.title}
                  </div>
                )}
                {item.author && (
                  <div>
                    <strong>Yazar:</strong> {item.author}
                  </div>
                )}
                {item.license && (
                  <div>
                    <strong>Lisans:</strong> {item.license}
                  </div>
                )}
                {item.source && (
                  <div>
                    <strong>Kaynak:</strong> {item.source}
                  </div>
                )}
                <div>
                  <strong>Durum:</strong>{" "}
                  <span
                    className={
                      item.approved === true
                        ? "text-green-600"
                        : item.approved === false
                        ? "text-red-600"
                        : "text-orange-600"
                    }
                  >
                    {item.approved === true
                      ? "✓ Onaylı"
                      : item.approved === false
                      ? "✗ Reddedildi"
                      : "⋯ Bekliyor"}
                  </span>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                {item.approved !== true && (
                  <button
                    onClick={() => handleApprove(item.id, true)}
                    className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                  >
                    ✓ Onayla
                  </button>
                )}
                {item.approved !== false && (
                  <button
                    onClick={() => handleApprove(item.id, false)}
                    className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                  >
                    ✗ Reddet
                  </button>
                )}
                <button
                  onClick={() => handleDelete(item.id)}
                  className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
                >
                  🗑 Sil
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
