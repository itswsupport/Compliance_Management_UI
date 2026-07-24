import { STATUS_LABELS } from './constants';

/**
 * Format date string to readable format
 */
export function formatDate(dateStr) {
  if (!dateStr) return '-';
  return dateStr;
}

/**
 * Get status badge info for a given numeric status code
 */
export function getStatusInfo(status) {
  return STATUS_LABELS[status] || { label: String(status), variant: 'secondary' };
}

/**
 * Extract filename from a full path string
 */
export function extractFilename(filePath) {
  if (!filePath || filePath === '-') return null;
  return filePath.replace(/^.*[/\\]/, '');
}

/**
 * Get today's date as YYYY-MM-DD
 */
export function todayDate() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get current time as hh:mm A (matching moment format)
 */
export function currentTime() {
  const now = new Date();
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
}

/**
 * Zero-pad a number to 3 digits (used for compliance serial numbers)
 */
export function padded(num) {
  const str = String(num);
  const pad = '000';
  return pad.substring(0, pad.length - str.length) + str;
}

/**
 * Determine which due date to show based on frequency
 */
export function getDueDate(row) {
  if (!row) return '-';
  if (row.compFrequency === 'AS & WHEN') {
    return row.lastDueDate || '-';
  }
  return row.firstDueDate || '-';
}

/**
 * Approval flow display name
 */
export function getFlowName(flowStatus) {
  if (flowStatus === 'PHR') return 'PLANT HR';
  return 'COMPLIANCE ADMIN';
}
