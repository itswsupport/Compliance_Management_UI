/**
 * "This record was just opened."
 *
 * Opening a compliance is reading its notification, whichever way it was
 * opened — off the bell, off the list, or off the calendar. The bell already
 * clears the one it was clicked on, but it lives in the navbar and the list
 * lives a long way from it, so the list has no way to tell it anything.
 *
 * This is that way: the list announces the id it opened, and the bell — the
 * only thing that knows which notifications are outstanding, and the only
 * thing that can clear one — listens and clears whatever points at it.
 *
 * A module-level Set rather than a context: the bell is mounted once for the
 * whole app, nothing else needs to hear this, and a provider around the router
 * would be a lot of wiring for one signal. The same shape DashboardNavCards
 * uses for its card cache.
 */
const listeners = new Set();

/**
 * Listen for opened records. Returns the unsubscribe, so an effect can return
 * it directly.
 */
export function onRecordOpened(fn) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Announce that the record with this id is now on screen. */
export function recordOpened(referenceId) {
  if (referenceId === null || referenceId === undefined || referenceId === '') return;
  listeners.forEach((fn) => fn(String(referenceId)));
}
