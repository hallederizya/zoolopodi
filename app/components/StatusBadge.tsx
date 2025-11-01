export default function StatusBadge({ code }: { code?: string|null }) {
  const map: Record<string, {label:string; cls:string}> = {
    "LC": { label:"Asgari Kaygı", cls:"bg-green-600" },
    "NT": { label:"Yakın Tehdit", cls:"bg-lime-600" },
    "VU": { label:"Hassas", cls:"bg-amber-600" },
    "EN": { label:"Tehlikede", cls:"bg-orange-600" },
    "CR": { label:"Kritik Tehlikede", cls:"bg-red-600" },
    "EW": { label:"Doğada Tükenmiş", cls:"bg-fuchsia-700" },
    "EX": { label:"Tükenmiş", cls:"bg-gray-700" }
  };
  const item = code ? map[code] : undefined;
  if (!item) return null;
  return <span className={`text-xs text-white px-2 py-1 rounded ${item.cls}`}>{code} • {item.label}</span>;
}
