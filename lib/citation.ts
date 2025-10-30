export function formatMediaAttribution(m: {
  title?: string | null;
  author?: string | null;
  source?: string | null;
  license?: string | null;
  url?: string | null;
}) {
  const parts: string[] = [];
  if (m.title) parts.push(m.title);
  if (m.author) parts.push(m.author);
  if (m.source) parts.push(m.source);
  if (m.license) parts.push(m.license);
  const text = parts.join(" — ");
  if (m.url) {
    return { html: `<a href="${m.url}" target="_blank" rel="noopener noreferrer">${text}</a>` };
  }
  return { html: text };
}
