import api, { NO_TIMEOUT } from './api';

/**
 * Notice list.
 *
 * The employee, not a plant: the server works out which plants they read
 * notices for. A Plant HR is named per plant in allhead_plant_master and can
 * hold several, so the plant on their own record is not the answer.
 * GET /notice/list?empCode=
 */
export const getNoticeList = (empCode) =>
  api.get('notice/list', { ...NO_TIMEOUT, params: { empCode: empCode || 0 } });

/**
 * One notice.
 * GET /notice/details/by_id?id=
 */
export const getNoticeById = (id) =>
  api.get('notice/details/by_id', { params: { id } });

/**
 * Publish a notice (Compliance Admin only).
 * POST /notice/save (multipart/form-data)
 */
export const saveNotice = (formData) =>
  api.post('notice/save', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

/**
 * Delete a notice (Compliance Admin only). The whole submission goes — every
 * plant row sharing the notice number, its read marks, and the document.
 * DELETE /notice/delete?id=
 */
export const deleteNotice = (id) =>
  api.delete('notice/delete', { params: { id } });

/**
 * Attachment link.
 *
 * Takes the notice id alone — the server holds the stored path, unlike the
 * compliance download which needs an id plus the file name.
 *
 * `download` asks the server for a save-to-disk disposition; without it a PDF
 * or an image opens in the tab instead. Two links, one file.
 * GET /notice/download/file?id=&download=
 */
export const getNoticeDownloadUrl = (id, download = false) =>
  `${api.defaults.baseURL}notice/download/file?id=${id}${download ? '&download=true' : ''}`;
