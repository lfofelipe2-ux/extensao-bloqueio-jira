import { getSettings } from "./storage.js";

const ATLASSIAN_API = "https://api.atlassian.com/ex/jira";

function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export async function getBaseUrl() {
  const s = await getSettings();
  if (s.scopedToken) {
    if (!s.cloudId) throw new Error("Cloud ID ausente para token com escopo");
    return `${ATLASSIAN_API}/${s.cloudId}`;
  }
  if (!s.jiraUrl) throw new Error("URL do Jira não configurada");
  return s.jiraUrl.replace(/\/+$/, "");
}

export async function getAuthHeaders() {
  const s = await getSettings();
  if (!s.email || !s.apiToken) throw new Error("E-mail ou token da API não configurado");
  return {
    Authorization: `Basic ${toBase64(`${s.email}:${s.apiToken}`)}`,
    Accept: "application/json",
  };
}
