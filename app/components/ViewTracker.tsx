"use client";
import { useEffect } from "react";

export function ViewTracker({ taxonId }: { taxonId: number }) {
  useEffect(() => {
    if (!Number.isFinite(taxonId)) return;
    
    fetch("/api/track/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: taxonId }),
    }).catch(() => {
      // Silent fail — tracking hatası kullanıcı deneyimini bozmamalı
    });
  }, [taxonId]);

  return null; // Bu component sadece side-effect için, UI render etmez
}
