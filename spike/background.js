const RULE_ID = 1;

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('spike.html') });
});

function baseUrl(cfg) {
  return cfg.scoped
    ? `https://api.atlassian.com/ex/jira/${cfg.cloudId}`
    : cfg.url;
}

function authHeader(cfg) {
  return 'Basic ' + btoa(`${cfg.email}:${cfg.token}`);
}

async function applyRule(cfg) {
  const requestHeaders = [];
  if (cfg.origin === 'remove') {
    requestHeaders.push({ header: 'origin', operation: 'remove' });
  } else if (cfg.origin === 'jira') {
    requestHeaders.push({ header: 'origin', operation: 'set', value: new URL(cfg.url).origin });
  }
  if (cfg.ua === 'remove') {
    requestHeaders.push({ header: 'user-agent', operation: 'remove' });
  } else if (cfg.ua === 'set') {
    requestHeaders.push({ header: 'user-agent', operation: 'set', value: 'jira-spike/0.1' });
  }
  const addRules = cfg.dnr && requestHeaders.length
    ? [{
        id: RULE_ID,
        priority: 1,
        action: { type: 'modifyHeaders', requestHeaders },
        condition: {
          requestDomains: [new URL(baseUrl(cfg)).hostname],
          resourceTypes: ['xmlhttprequest'],
          tabIds: [-1],
        },
      }]
    : [];
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [RULE_ID],
    addRules,
  });
  return addRules.length ? requestHeaders.map((h) => `${h.operation} ${h.header}`) : [];
}

function adf(text) {
  return {
    type: 'doc',
    version: 1,
    content: text.split('\n').map((line) => ({
      type: 'paragraph',
      content: line ? [{ type: 'text', text: line }] : [],
    })),
  };
}

async function jira(cfg, method, path, body) {
  const headers = {
    Authorization: authHeader(cfg),
    Accept: 'application/json',
  };
  if (method !== 'GET') {
    headers['Content-Type'] = 'application/json';
    headers['X-Atlassian-Token'] = 'no-check';
  }
  const applied = await applyRule(cfg);
  const res = await fetch(`${baseUrl(cfg)}${path}`, {
    method,
    headers,
    credentials: 'omit',
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return {
    request: `${method} ${path}`,
    dnrApplied: applied,
    status: res.status,
    ok: res.ok,
    xsrfFailure: /xsrf/i.test(text),
    body: text.slice(0, 2000),
  };
}

async function run({ op, cfg }) {
  const key = encodeURIComponent(cfg.key);
  switch (op) {
    case 'test':
      return jira(cfg, 'GET', '/rest/api/3/myself');
    case 'transitions':
      return jira(cfg, 'GET', `/rest/api/3/issue/${key}/transitions`);
    case 'comment':
      return jira(cfg, 'POST', `/rest/api/3/issue/${key}/comment`, {
        body: adf(`XSRF spike test comment ${new Date().toISOString()}`),
      });
    case 'transition':
      return jira(cfg, 'POST', `/rest/api/3/issue/${key}/transitions`, {
        transition: { id: cfg.tid },
      });
    default:
      throw new Error(`unknown op ${op}`);
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  run(msg)
    .then(sendResponse)
    .catch((e) => sendResponse({ error: String(e && e.message ? e.message : e) }));
  return true;
});
