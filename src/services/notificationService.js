import api from './api';

/**
 * In-portal notifications.
 *
 * These rows are written by the server where the mails are sent, from the same
 * variables — see NotificationService in the backend. The bell renders what it
 * is given and works nothing out for itself: whoever received the mail has the
 * row, and the row says what the mail said.
 */

/** Unread notifications for one employee, newest first. */
export const getNotifications = (empCode) =>
  api.get('notifications/list', { params: { empCode } });

/** Just the number, for the badge. */
export const getUnreadCount = (empCode) =>
  api.get('notifications/unread-count', { params: { empCode } });

/** Clear one, when it is opened. */
export const markNotificationRead = (id, empCode) =>
  api.post('notifications/mark-read', null, { params: { id, empCode } });

/** Clear the lot. */
export const markAllNotificationsRead = (empCode) =>
  api.post('notifications/mark-all-read', null, { params: { empCode } });

/**
 * Clear this employee's notice notifications, all of them, in one call.
 *
 * The Notice Dashboard lists every notice at once, so opening it has read the
 * lot — marking them one at a time would be a request per notice for something
 * the user did in a single action. Compliance rows are left alone: each is a
 * task still waiting on somebody.
 * POST /notifications/mark-notice-read?empCode=
 */
export const markNoticeNotificationsRead = (empCode) =>
  api.post('notifications/mark-notice-read', null, { params: { empCode } });
