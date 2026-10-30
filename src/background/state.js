export const COLORS = { primary: 'green', secondary: 'orange', unknown: 'grey' };

const REQUIRED = [
  'jiraUrl',
  'email',
  'apiToken',
  'boardId',
  'columnId',
  'primaryStatusId',
  'secondaryStatusId',
];

export function isConfigured(settings) {
  return !!settings && REQUIRED.every((k) => settings[k] != null && settings[k] !== '');
}

export function pollPeriodMinutes(pollSeconds) {
  const seconds = Number(pollSeconds) || 60;
  return Math.max(seconds, 30) / 60;
}

export function iconPaths(state) {
  const color = COLORS[state] || COLORS.unknown;
  return Object.fromEntries([16, 32, 48, 128].map((s) => [s, `icons/${color}-${s}.png`]));
}

function grey(reason, tooltip) {
  return {
    state: 'unknown',
    issueKey: null,
    summary: null,
    statusName: null,
    tooltip,
    offline: false,
    reason,
  };
}

function describe(issue) {
  const status = issue.fields?.status || {};
  return {
    issueKey: issue.key,
    summary: issue.fields?.summary ?? '',
    statusId: String(status.id ?? ''),
    statusName: status.name ?? '',
  };
}

export function computeRuntime({ settings, issues, error, previous }) {
  if (!isConfigured(settings)) return grey('unconfigured', 'Extensão não configurada');

  if (error) {
    if (error.kind === 'auth') return grey('auth', 'Credenciais inválidas ou expiradas');
    if (error.kind === 'network') {
      const base = previous || grey('error', 'Jira');
      const tooltip = (base.tooltip || '').replace(/ \(offline\)$/, '') + ' (offline)';
      return { ...base, tooltip, offline: true };
    }
    return grey('error', `Erro ao consultar o Jira: ${error.message || 'desconhecido'}`);
  }

  if (!issues || issues.length === 0) return grey('none', 'Nenhuma tarefa na coluna');
  if (issues.length > 1) return grey('multiple', 'Mais de uma tarefa na coluna');

  const d = describe(issues[0]);
  const tooltip = `${d.issueKey} – ${d.summary} – ${d.statusName}`;
  let state = 'unknown';
  let reason = 'other-status';
  if (d.statusId === String(settings.primaryStatusId)) {
    state = 'primary';
    reason = 'ok';
  } else if (d.statusId === String(settings.secondaryStatusId)) {
    state = 'secondary';
    reason = 'ok';
  }
  return {
    state,
    issueKey: d.issueKey,
    summary: d.summary,
    statusName: d.statusName,
    tooltip,
    offline: false,
    reason,
  };
}

export function decideClick(runtime) {
  switch (runtime?.state) {
    case 'primary':
      return 'transition-secondary';
    case 'secondary':
      return 'open-dialog';
    default:
      return runtime?.reason === 'unconfigured' || runtime?.reason === 'auth' || !runtime
        ? 'open-options'
        : 'refresh';
  }
}
