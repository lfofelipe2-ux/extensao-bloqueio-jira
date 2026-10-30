import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { installChromeMock } from "./chrome-mock.js";
import {
  getSettings, setSettings, getRuntime, setRuntime, isConfigured, DEFAULT_SETTINGS,
} from "../src/lib/storage.js";

let data;
beforeEach(() => {
  data = installChromeMock();
});

test("settings default when nothing is stored", async () => {
  assert.deepEqual(await getSettings(), DEFAULT_SETTINGS);
});

test("setSettings merges patches", async () => {
  await setSettings({ jiraUrl: "https://a.atlassian.net" });
  const saved = await setSettings({ email: "a@b.c" });
  assert.equal(saved.jiraUrl, "https://a.atlassian.net");
  assert.equal(saved.email, "a@b.c");
  assert.equal(data.settings.email, "a@b.c");
});

test("pollSeconds is clamped to 30 and falls back to 60", async () => {
  assert.equal((await setSettings({ pollSeconds: 5 })).pollSeconds, 30);
  assert.equal((await setSettings({ pollSeconds: 90 })).pollSeconds, 90);
  assert.equal((await setSettings({ pollSeconds: "abc" })).pollSeconds, 60);
});

test("runtime defaults to unknown and merges", async () => {
  assert.equal((await getRuntime()).state, "unknown");
  await setRuntime({ state: "primary", issueKey: "ABC-1" });
  const r = await setRuntime({ offline: true });
  assert.deepEqual([r.state, r.issueKey, r.offline], ["primary", "ABC-1", true]);
});

test("isConfigured requires all fields and distinct statuses", () => {
  const ok = {
    ...DEFAULT_SETTINGS, jiraUrl: "https://a.atlassian.net", email: "a@b.c", apiToken: "t",
    boardId: "1", columnId: "2", primaryStatusId: "10", secondaryStatusId: "11",
  };
  assert.equal(isConfigured(ok), true);
  assert.equal(isConfigured({ ...ok, apiToken: "" }), false);
  assert.equal(isConfigured({ ...ok, secondaryStatusId: "10" }), false);
  assert.equal(isConfigured({ ...ok, scopedToken: true }), false);
  assert.equal(isConfigured({ ...ok, scopedToken: true, cloudId: "c" }), true);
});

test("undefined and null patch values do not clobber stored values", async () => {
  await setSettings({ email: "a@b.c" });
  const saved = await setSettings({ email: undefined, jiraUrl: null });
  assert.equal(saved.email, "a@b.c");
  assert.equal(saved.jiraUrl, "");
});

test("null or empty pollSeconds falls back to 60", async () => {
  assert.equal((await setSettings({ pollSeconds: "" })).pollSeconds, 60);
  data.settings.pollSeconds = 1;
  assert.equal((await getSettings()).pollSeconds, 30);
});

test("non-object stored values fall back to defaults", async () => {
  data.settings = "corrupt";
  assert.deepEqual(await getSettings(), DEFAULT_SETTINGS);
});
