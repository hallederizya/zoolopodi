const legendMap: Record<string, string> = {
  LC: "Least Concern (Asgari Kaygı)",
  NT: "Near Threatened (Tehdide Yakın)",
  VU: "Vulnerable (Hassas)",
  EN: "Endangered (Tehlike Altında)",
  CR: "Critically Endangered (Kritik Tehlike)",
  EW: "Extinct in the Wild (Doğada Soyu Tükenmiş)",
  EX: "Extinct (Soyu Tükenmiş)"
};

export default function IucnBadge({ cat }: { cat?: string }) {
  if (!cat) return null;
  const map: Record<string, string> = {
    LC: "bg-green-100 text-green-800",
    NT: "bg-lime-100 text-lime-800",
    VU: "bg-yellow-100 text-yellow-800",
    EN: "bg-orange-100 text-orange-800",
    CR: "bg-red-100 text-red-800",
    EW: "bg-gray-300 text-gray-900",
    EX: "bg-gray-200 text-gray-800"
  };
  const cls = map[cat as keyof typeof map] ?? "bg-gray-100 text-gray-800";
  const title = legendMap[cat] || cat;
  return (
    <span
      className={`inline-block px-2 py-1 rounded text-sm ${cls} cursor-help`}
      title={title}
    >
      IUCN: {cat}
    </span>
  );
}
