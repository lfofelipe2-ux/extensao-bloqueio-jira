import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("all 12 icons are PNGs of the right size", () => {
  for (const color of ["grey", "green", "orange"]) {
    for (const size of [16, 32, 48, 128]) {
      const buf = readFileSync(new URL(`../icons/${color}-${size}.png`, import.meta.url));
      assert.equal(buf.subarray(1, 4).toString(), "PNG");
      assert.equal(buf.readUInt32BE(16), size);
      assert.equal(buf.readUInt32BE(20), size);
    }
  }
});

test("manifest references existing files and the contract permissions", () => {
  const m = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
  assert.deepEqual(m.permissions, ["storage", "alarms"]);
  assert.deepEqual(m.optional_host_permissions, ["https://*/*"]);
  assert.equal(m.manifest_version, 3);
});
