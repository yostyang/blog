/** Next.js 16 passes some dynamic params percent-encoded. Decode when needed. */
export function decodeParam(value: string) {
  let current = value;
  for (let i = 0; i < 2 && current.includes("%"); i += 1) {
    try {
      const next = decodeURIComponent(current);
      if (next === current) break;
      current = next;
    } catch {
      break;
    }
  }
  return current;
}
