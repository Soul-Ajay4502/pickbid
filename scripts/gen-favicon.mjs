/**
 * Generates src/app/favicon.ico from the branded cricket-ball mark so the
 * classic favicon matches app/icon.tsx and app/apple-icon.tsx.
 *
 * Run:  node scripts/gen-favicon.mjs
 * Preview: FAVICON_PREVIEW=1 node scripts/gen-favicon.mjs   (also writes a PNG)
 *
 * Uses sharp (already a dependency via Next) to rasterize an SVG at several
 * sizes, then packs them into a multi-resolution ICO (PNG-compressed entries,
 * supported by every modern browser).
 */
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#16a34a"/>
      <stop offset="0.55" stop-color="#059669"/>
      <stop offset="1" stop-color="#0d9488"/>
    </linearGradient>
    <linearGradient id="ball" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fb7185"/>
      <stop offset="1" stop-color="#9f1239"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="256" height="256" rx="52" ry="52" fill="url(#bg)"/>
  <circle cx="128" cy="128" r="76" fill="url(#ball)"/>
  <g transform="rotate(10 128 128)">
    <line x1="128" y1="70" x2="128" y2="186" stroke="#ffffff" stroke-opacity="0.92"
          stroke-width="7" stroke-linecap="round" stroke-dasharray="10 9"/>
  </g>
</svg>`;

const sizes = [16, 32, 48, 256];

const pngs = await Promise.all(
  sizes.map((s) => sharp(Buffer.from(SVG)).resize(s, s).png().toBuffer()),
);

// Assemble the ICO container.
const count = sizes.length;
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(count, 4); // image count

const entries = [];
let offset = 6 + count * 16;
sizes.forEach((s, i) => {
  const png = pngs[i];
  const e = Buffer.alloc(16);
  e.writeUInt8(s >= 256 ? 0 : s, 0); // width (0 = 256)
  e.writeUInt8(s >= 256 ? 0 : s, 1); // height
  e.writeUInt8(0, 2); // palette colors
  e.writeUInt8(0, 3); // reserved
  e.writeUInt16LE(1, 4); // color planes
  e.writeUInt16LE(32, 6); // bits per pixel
  e.writeUInt32LE(png.length, 8); // image size
  e.writeUInt32LE(offset, 12); // image offset
  entries.push(e);
  offset += png.length;
});

const ico = Buffer.concat([header, ...entries, ...pngs]);
const out = join(process.cwd(), 'src/app/favicon.ico');
writeFileSync(out, ico);
console.log(`Wrote ${out} (${ico.length} bytes, sizes ${sizes.join(', ')})`);

if (process.env.FAVICON_PREVIEW) {
  const preview = join(process.cwd(), '_favicon_preview.png');
  writeFileSync(preview, pngs[sizes.indexOf(256)]);
  console.log(`Wrote ${preview}`);
}
