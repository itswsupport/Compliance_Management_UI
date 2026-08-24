/**
 * What an uploaded document may be, for the two forms that take one — Assign
 * Compliance and Add Notice.
 *
 * The server enforces the same rule (utils/Attachments.java); this is here so
 * the user is told before a 50MB upload rather than after it. One copy so the
 * two forms cannot drift apart.
 */
export const MAX_FILE_MB = 50;

export const ALLOWED_EXT = ['.pdf', '.xls', '.xlsx', '.jpg', '.jpeg', '.png'];

/**
 * What a file name may be made of: letters, digits, spaces, and . - _ ( )
 *
 * Everything else is refused. The name is not sanitised on the way in — it is
 * stored and served back exactly as uploaded — so a slash or a backslash aims
 * the file somewhere else on disk, and #, %, ? or & cut the download link
 * short at the character. Rejecting the name is honest; silently renaming the
 * user's file is not.
 */
const SAFE_NAME = /^[A-Za-z0-9 ._()-]+$/;

/**
 * The browser's own file-picker filter. A suggestion only — it can be switched
 * off in the dialog, which is why fileError runs on whatever comes back.
 */
export const ACCEPT = ALLOWED_EXT.join(',');

/** The problem with this file, or '' when there is none. */
export function fileError(file) {
  if (!file) return '';
  const name = file.name || '';
  const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
  if (!name.includes('.') || !ALLOWED_EXT.includes(ext)) {
    return 'ONLY PDF, EXCEL, JPG AND PNG FILES ARE ALLOWED';
  }
  if (!SAFE_NAME.test(name)) {
    return 'Special characters are not allowed in the file name. Please rename it.';
  }
  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    return `FILE IS LARGER THAN ${MAX_FILE_MB}MB`;
  }
  return '';
}

/** "PDF, Excel, JPG, PNG · max 50MB" — the hint shown under a file input. */
export const FILE_HINT = `PDF, Excel, JPG, PNG · max ${MAX_FILE_MB}MB`;
