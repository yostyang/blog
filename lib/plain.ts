export function plainText(markdown: string) {
  return markdown
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~|[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
