import { deflateRawSync, crc32 } from 'node:zlib';
import { readdirSync, readFileSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const DOS_DATE = 0x0021;
const root = fileURLToPath(new URL('..', import.meta.url));
const outDir = join(root, 'dist');
const edge = process.argv.includes('--edge');
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
const { version } = manifest;
const outFile = join(outDir, `jira-status-toggle${edge ? '-edge' : ''}-${version}.zip`);

if (edge) delete manifest.minimum_chrome_version;
const manifestData = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);

function walk(dir) {
  return readdirSync(dir).sort().flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const files = [
  join(root, 'manifest.json'),
  ...walk(join(root, 'icons')),
  ...walk(join(root, 'src')).filter((p) => !/\.test\.[cm]?js$/.test(p) && !p.endsWith('.gitkeep')),
].map((p) => relative(root, p).split(sep).join('/'));

const locals = [];
const centrals = [];
let offset = 0;
for (const name of files) {
  const data = name === 'manifest.json' ? manifestData : readFileSync(join(root, name));
  const comp = deflateRawSync(data);
  const nameBuf = Buffer.from(name);
  const crc = crc32(data);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6);
  local.writeUInt16LE(8, 8);
  local.writeUInt16LE(DOS_DATE, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(comp.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBuf.length, 26);
  locals.push(local, nameBuf, comp);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(8, 10);
  central.writeUInt16LE(DOS_DATE, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(comp.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(nameBuf.length, 28);
  central.writeUInt32LE(offset, 42);
  centrals.push(central, nameBuf);

  offset += local.length + nameBuf.length + comp.length;
}

const centralBuf = Buffer.concat(centrals);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralBuf.length, 12);
end.writeUInt32LE(offset, 16);

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, Buffer.concat([...locals, centralBuf, end]));
console.log(`${outFile} (${files.length} files)`);
