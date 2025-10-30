"use client";
import { formatMediaAttribution } from "@/lib/citation";

export default function MediaAttribution({ item }: { item: any }) {
  const { html } = formatMediaAttribution(item);
  return <figcaption className="text-xs mt-1" dangerouslySetInnerHTML={{ __html: html }} />;
}
