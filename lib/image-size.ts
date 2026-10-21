import "server-only";
import fs from "fs";
import path from "path";

export type ImageSize = { width: number; height: number };

const cache = new Map<string, ImageSize | null>();

function readSize(buf: Buffer): ImageSize | null {
  if (buf.length > 24 && buf[0] === 0x89 && buf.toString("ascii", 1, 4) === "PNG") {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf.length > 10 && buf.toString("ascii", 0, 3) === "GIF") {
    return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let offset = 2;
    while (offset + 8 < buf.length) {
      if (buf[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buf[offset + 1];
      if (marker === 0xd8 || marker === 0xd9) {
        offset += 2;
        continue;
      }
      const length = buf.readUInt16BE(offset + 2);
      if (
        marker === 0xc0 ||
        marker === 0xc1 ||
        marker === 0xc2 ||
        marker === 0xc3
      ) {
        return {
          height: buf.readUInt16BE(offset + 5),
          width: buf.readUInt16BE(offset + 7),
        };
      }
      offset += 2 + length;
    }
  }
  return null;
}

export function getImageSize(src: string): ImageSize | undefined {
  if (!src.startsWith("/images/")) return undefined;
  if (cache.has(src)) return cache.get(src) ?? undefined;
  try {
    const file = path.join(process.cwd(), "public", src);
    const size = readSize(fs.readFileSync(file));
    cache.set(src, size);
    return size ?? undefined;
  } catch {
    cache.set(src, null);
    return undefined;
  }
}
