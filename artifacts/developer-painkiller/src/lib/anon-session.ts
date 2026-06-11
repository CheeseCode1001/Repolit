const ANON_ID_KEY = "repograph-anon-id";

/**
 * Returns the current anonymous session ID, generating one if it doesn't exist.
 * Stored in localStorage so it persists across page reloads.
 */
export function getAnonId(): string {
  try {
    const existing = localStorage.getItem(ANON_ID_KEY);
    if (existing && existing.length > 0) return existing;

    const newId = crypto.randomUUID();
    localStorage.setItem(ANON_ID_KEY, newId);
    return newId;
  } catch {
    return crypto.randomUUID();
  }
}

/**
 * Clear the anonymous session (called when a user signs in or signs up,
 * so the server can migrate their anon data to their real account).
 */
export function clearAnonId(): void {
  try {
    localStorage.removeItem(ANON_ID_KEY);
  } catch { /* ignore */ }
}
