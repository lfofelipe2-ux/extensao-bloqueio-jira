const $ = (id) => document.getElementById(id);
const GATEWAY = 'https://api.atlassian.com';

function config() {
  return {
    url: $('url').value.trim().replace(/\/+$/, ''),
    email: $('email').value.trim(),
    token: $('token').value,
    key: $('key').value.trim(),
    tid: $('tid').value.trim(),
    scoped: $('scoped').checked,
    cloudId: $('cloudId').value.trim(),
    dnr: $('dnr').checked,
    origin: $('origin').value,
    ua: $('ua').value,
  };
}

function show(value) {
  $('out').textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

async function call(op) {
  show('...');
  try {
    show(await chrome.runtime.sendMessage({ op, cfg: config() }));
  } catch (e) {
    show(String(e));
  }
}

$('perm').onclick = async () => {
  const { url, scoped } = config();
  const origins = [`${new URL(url).origin}/*`];
  if (scoped) origins.push(`${GATEWAY}/*`);
  show({ granted: await chrome.permissions.request({ origins }) });
};

$('detect').onclick = async () => {
  const { url } = config();
  try {
    const res = await fetch(`${url}/_edge/tenant_info`, { credentials: 'omit' });
    const data = await res.json();
    $('cloudId').value = data.cloudId || '';
    show(data);
  } catch (e) {
    show(String(e));
  }
};

$('test').onclick = () => call('test');
$('list').onclick = () => call('transitions');
$('comment').onclick = () => call('comment');
$('transition').onclick = () => call('transition');
