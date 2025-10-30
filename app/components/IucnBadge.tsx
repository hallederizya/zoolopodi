export default function IucnBadge({ cat }: { cat?: string }) {
  if (!cat) return null;
  const map: Record<string, string> = {
    LC: "bg-green-100 text-green-800",
    NT: "bg-lime-100 text-lime-800",
    VU: "bg-yellow-100 text-yellow-800",
    EN: "bg-orange-100 text-orange-800",
    CR: "bg-red-100 text-red-800",
    EX: "bg-gray-200 text-gray-800"
  };
  const cls = map[cat as keyof typeof map] ?? "bg-gray-100 text-gray-800";
  return <span className={`inline-block px-2 py-1 rounded text-sm ${cls}`}>IUCN: {cat}</span>;
}
