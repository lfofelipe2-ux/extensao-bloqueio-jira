import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const COLORS = {
  green: [34, 160, 80],
  orange: [240, 140, 20],
  grey: [140, 140, 140],
};
const SIZES = [16, 32, 48, 128];
const out = join(dirname(fileURLToPath(import.meta.url)), "..", "icons");

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function render(size, [r, g, b]) {
  const rows = [];
  const c = size / 2;
  const radius = size / 2 - Math.max(0.5, size * 0.04);
  const ring = Math.max(1, size * 0.09);
  const SS = 4;
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    for (let x = 0; x < size; x++) {
      let cover = 0;
      let inner = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const d = Math.hypot(x + (sx + 0.5) / SS - c, y + (sy + 0.5) / SS - c);
          if (d <= radius) cover++;
          if (d <= radius - ring) inner++;
        }
      }
      const total = SS * SS;
      const shade = inner / total;
      const o = 1 + x * 4;
      row[o] = Math.round(r * (0.7 + 0.3 * shade));
      row[o + 1] = Math.round(g * (0.7 + 0.3 * shade));
      row[o + 2] = Math.round(b * (0.7 + 0.3 * shade));
      row[o + 3] = Math.round((cover / total) * 255);
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync(out, { recursive: true });
for (const [name, rgb] of Object.entries(COLORS)) {
  for (const size of SIZES) writeFileSync(join(out, `${name}-${size}.png`), render(size, rgb));
}
