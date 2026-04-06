/**
 * Shared guard to prevent re-fetching data immediately after a local action.
 * Uses module-level variables — NO re-renders, accessible from any component.
 */

let _lastLocalAction = 0;
const SKIP_WINDOW = 3000; // 3 seconds

/** Call this BEFORE any optimistic state update */
export function markLocalAction() {
  _lastLocalAction = Date.now();
}

/** Returns true if a local action happened recently — skip re-fetch */
export function shouldSkipRefetch(): boolean {
  return Date.now() - _lastLocalAction < SKIP_WINDOW;
}
