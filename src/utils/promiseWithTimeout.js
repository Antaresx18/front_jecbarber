/**
 * Rechaza si `promise` no resuelve en `ms` milisegundos.
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @param {string} [message]
 * @returns {Promise<T>}
 */
export function promiseWithTimeout(promise, ms, message = 'TIMEOUT') {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

/**
 * Timeout propio, AbortError del fetch o mensajes relacionados.
 * @param {unknown} err
 * @returns {boolean}
 */
export function isTimeoutLikeError(err) {
  if (err == null) return false;
  if (typeof err === 'object' && 'name' in err && err.name === 'AbortError') return true;
  const msg = err instanceof Error ? err.message : String(err);
  if (
    msg === 'TIMEOUT' ||
    msg === 'SESSION_TIMEOUT' ||
    msg === 'PROFILE_TIMEOUT' ||
    msg === 'AUTH_SIGNIN_TIMEOUT'
  ) {
    return true;
  }
  return /aborted|timeout/i.test(msg);
}
