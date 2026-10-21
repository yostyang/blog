export function formatDate(iso: string) {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${year}年${Number(month)}月${Number(day)}日`;
}

export function readingMinutes(markdown: string) {
  const plain = markdown
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/[#>*_`\\[\]]/g, "")
    .replace(/\s+/g, "");
  return Math.max(1, Math.round(plain.length / 400));
}
