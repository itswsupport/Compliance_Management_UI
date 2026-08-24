/**
 * "The notices have just been read."
 *
 * Opening the Notice Dashboard clears every notice notification on the server,
 * but the bell lives in the navbar and stays mounted for the whole session — so
 * nothing would tell it, and it would keep showing them until its next
 * sixty-second read. A badge for something the user is looking at.
 *
 * The board announces, the bell drops them at once. A module-level Set rather
 * than a context: the bell is mounted once, nothing else needs to hear this,
 * and it is the same shape recordOpened uses.
 */
const listeners = new Set();

/** Listen. Returns the unsubscribe, so an effect can return it directly. */
export function onNoticesRead(fn) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Announce that this user's notice notifications are now read. */
export function noticesRead() {
  listeners.forEach((fn) => fn());
}
