"use client";

function LicenseBadge({ license }: { license?: string | null }) {
  if (!license) return null;
  return <span className="text-[10px] px-2 py-1 bg-gray-100 rounded">{license}</span>;
}

export default function MediaAttribution({ item }: { item: any }) {
  const parts: string[] = [];
  if (item.title) parts.push(item.title);
  if (item.author) parts.push(item.author);
  if (item.source) parts.push(item.source);
  
  const text = parts.join(" — ");
  
  return (
    <figcaption className="text-xs mt-1 flex items-center gap-2 flex-wrap">
      {item.url ? (
        <a 
          href={item.url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          {text}
        </a>
      ) : (
        <span>{text}</span>
      )}
      <LicenseBadge license={item.license} />
    </figcaption>
  );
}
