export const AUTH_MESSAGE = 'Credenciais inválidas ou expiradas';

export function isBlank(text) {
  return typeof text !== 'string' || text.trim() === '';
}

function toFailure(error, step) {
  const kind = error?.kind ?? 'other';
  const message = kind === 'auth' ? AUTH_MESSAGE : error?.message || 'Erro desconhecido';
  return { ok: false, step, kind, message };
}

export function createReturnFlow({ client, primaryStatusId }) {
  let commentPosted = false;
  let inFlight = false;

  return {
    get commentPosted() {
      return commentPosted;
    },

    async submit(key, text) {
      if (inFlight) {
        return { ok: false, step: 'validation', kind: 'other', message: 'Envio em andamento.' };
      }
      if (!key || !primaryStatusId) {
        return { ok: false, step: 'validation', kind: 'config', message: 'Status primário não configurado.' };
      }
      if (!commentPosted && isBlank(text)) {
        return { ok: false, step: 'validation', kind: 'other', message: 'Descreva o que você fez.' };
      }

      inFlight = true;
      try {
        if (!commentPosted) {
          try {
            await client.addComment(key, text.trim());
          } catch (error) {
            return toFailure(error, 'comment');
          }
          commentPosted = true;
        }

        try {
          await client.transitionTo(key, primaryStatusId);
        } catch (error) {
          return toFailure(error, 'transition');
        }
        return { ok: true };
      } finally {
        inFlight = false;
      }
    },
  };
}
