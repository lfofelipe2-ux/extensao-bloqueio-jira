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

  return {
    get commentPosted() {
      return commentPosted;
    },

    async submit(key, text) {
      if (!commentPosted && isBlank(text)) {
        return { ok: false, step: 'validation', kind: 'other', message: 'Descreva o que você fez.' };
      }

      if (!commentPosted) {
        try {
          await client.addComment(key, text);
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
    },
  };
}
