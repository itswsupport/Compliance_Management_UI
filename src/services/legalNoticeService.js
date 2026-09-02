import api, { NO_TIMEOUT } from './api';

/**
 * Legal notices.
 *
 * A separate flow from the notices in noticeService: a notice is published by
 * the Comp Admin and read, while a legal notice is raised by a Plant HR,
 * submitted by them, and then approved or rejected by the Comp Admin — with a
 * reject sending it straight back to them. Different tables, different
 * endpoints, nothing shared.
 */

/**
 * The plants this employee may raise a legal notice against.
 *
 * The server works them out — a Plant HR is named per plant in
 * allhead_plant_master and can hold several, so the plant on their own employee
 * record is not the answer. One plant back means the form pre-selects it.
 * GET /legal_notice/plants?empCode=
 */
export const getLegalNoticePlants = (empCode) =>
  api.get('legal_notice/plants', { params: { empCode: empCode || 0 } });

/**
 * Every legal notice this employee may see, newest first.
 *
 * One list for every card: Pending, Approved and Overdue are the same rows read
 * three ways, so the dashboard splits them itself rather than asking the server
 * three times to draw one screen.
 * GET /legal_notice/list?empCode=
 */
export const getLegalNoticeList = (empCode) =>
  api.get('legal_notice/list', { ...NO_TIMEOUT, params: { empCode: empCode || 0 } });

/**
 * One legal notice, with its action history on `actionList`.
 * GET /legal_notice/details/by_id?id=
 */
export const getLegalNoticeById = (id) =>
  api.get('legal_notice/details/by_id', { params: { id } });

/**
 * One notice's action history, oldest first.
 *
 * details/by_id already carries it — this is for a refresh after an action,
 * when the notice itself has not changed shape.
 * GET /legal_notice/action/list?mstId=
 */
export const getLegalNoticeActions = (mstId) =>
  api.get('legal_notice/action/list', { params: { mstId } });

/**
 * Raise a legal notice (Plant HR only, against one of their own plants).
 * POST /legal_notice/save (multipart/form-data)
 */
export const saveLegalNotice = (formData) =>
  api.post('legal_notice/save', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

/**
 * Take the next step on a legal notice.
 *
 * One endpoint for both sides: which step it is comes from the notice's own
 * status and the caller's role on the server, so nothing here decides it.
 * POST /legal_notice/action/save (multipart/form-data)
 */
export const saveLegalNoticeAction = (formData) =>
  api.post('legal_notice/action/save', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

/**
 * The document the notice was raised with.
 *
 * Takes the notice id alone — the server holds the stored path. `download` asks
 * for a save-to-disk disposition; without it a PDF or an image opens in the tab.
 * GET /legal_notice/download/file?id=&download=
 */
export const getLegalNoticeDownloadUrl = (id, download = false) =>
  `${api.defaults.baseURL}legal_notice/download/file?id=${id}${download ? '&download=true' : ''}`;

/**
 * A document attached to one step of the history.
 *
 * Takes the ACTION id, not the notice id: a notice that was rejected and
 * submitted again carries a document per submission.
 * GET /legal_notice/action/download/file?id=&download=
 */
export const getLegalNoticeActionDownloadUrl = (actionId, download = false) =>
  `${api.defaults.baseURL}legal_notice/action/download/file?id=${actionId}${download ? '&download=true' : ''}`;
