import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { installChromeMock } from "./chrome-mock.js";
import { setSettings } from "../src/lib/storage.js";
import { getBaseUrl, getAuthHeaders } from "../src/lib/auth.js";

beforeEach(() => {
  installChromeMock();
});

test("base url strips trailing slashes", async () => {
  await setSettings({ jiraUrl: "https://a.atlassian.net//" });
  assert.equal(await getBaseUrl(), "https://a.atlassian.net");
});

test("scoped token uses the api.atlassian.com gateway", async () => {
  await setSettings({ jiraUrl: "https://a.atlassian.net", scopedToken: true, cloudId: "abc-123" });
  assert.equal(await getBaseUrl(), "https://api.atlassian.com/ex/jira/abc-123");
});

test("base url throws when unconfigured", async () => {
  await assert.rejects(getBaseUrl());
  await setSettings({ scopedToken: true });
  await assert.rejects(getBaseUrl());
});

test("auth header is Basic base64(email:token), UTF-8 safe", async () => {
  await setSettings({ email: "joão@b.c", apiToken: "tok" });
  const { Authorization } = await getAuthHeaders();
  const decoded = Buffer.from(Authorization.replace("Basic ", ""), "base64").toString("utf8");
  assert.equal(decoded, "joão@b.c:tok");
});

test("missing credentials throw without leaking the token", async () => {
  await setSettings({ apiToken: "secret-token" });
  await assert.rejects(getAuthHeaders(), (e) => !e.message.includes("secret-token"));
});
