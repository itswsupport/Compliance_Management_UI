export function sectionOf(pathname) {
  return String(pathname || '').split('/')[1] || '';
}

let lastSection = null;

export function enteredSection(pathname) {
  const section = sectionOf(pathname);
  const arrived = lastSection !== section;
  lastSection = section;
  return arrived;
}

export function recordSection(pathname) {
  lastSection = sectionOf(pathname);
}
