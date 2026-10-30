import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

test("all 12 icons are PNGs of the right size", () => {
  for (const color of ["grey", "green", "orange"]) {
    for (const size of [16, 32, 48, 128]) {
      const buf = readFileSync(new URL(`../icons/${color}-${size}.png`, import.meta.url));
      assert.deepEqual([...buf.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      assert.equal(buf.readUInt32BE(16), size);
      assert.equal(buf.readUInt32BE(20), size);
    }
  }
});

test("manifest has contract permissions and existing files", () => {
  const m = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
  assert.deepEqual(m.permissions, ["storage", "alarms"]);
  assert.deepEqual(m.optional_host_permissions, ["https://*/*"]);
  assert.equal(m.manifest_version, 3);
  for (const p of [...Object.values(m.icons), ...Object.values(m.action.default_icon), m.background.service_worker]) {
    assert.ok(existsSync(new URL(`../${p}`, import.meta.url)), p);
  }
});
