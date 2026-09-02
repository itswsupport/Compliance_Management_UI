import { useState, useEffect, useCallback } from 'react';
import Swal from 'sweetalert2';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/ui/StatusBadge';
import {
  getLegalNoticeById,
  saveLegalNoticeAction,
  getLegalNoticeDownloadUrl,
  getLegalNoticeActionDownloadUrl,
} from '../../services/legalNoticeService';
import { extractFilename, todayDate } from '../../utils/formatters';
import { ACCEPT, FILE_HINT, fileError } from '../../utils/attachments';
import { legalActionInfo, canAct, actionKind } from '../../utils/legalNoticeRows';

// Matches the DB comment column width (500) — keep the two in sync, exactly as
// COMMENT_MAX does in Compliance View.
const COMMENT_MAX = 500;

/**
 * One legal notice: what it is, what has happened to it, and what this user can
 * do about it next.
 *
 * Laid out as Compliance View is, card for card — numbered details, then the
 * action history, then the action — because it is the same job on a different
 * record, and somebody who has approved a compliance should not have to learn a
 * second screen to approve a legal notice.
 *
 * Always embedded: the Legal Notice dashboard swaps it in where its table was,
 * so there is no page title row and no Back button of its own; the card header
 * supplies both.
 *
 * Which of the two action forms is drawn comes from the notice's own status, not
 * from the user's role. A user holding both Plant HR and Comp Admin therefore
 * sees the form the notice is actually waiting for rather than the one their
 * highest role would suggest — the same problem Compliance View solves by
 * reading the pending row's authLevel, reached here without the bookkeeping.
 *
 * Props:
 *   id       — compliance_legal_notice.id
 *   readOnly — a reader role: they see the details and the action history,
 *              but get no action form — they read the notice, they do not
 *              move it
 *   onBack   — called when the user leaves; `true` when something was saved, so
 *              the host knows whether its list is now stale
 */
export default function LegalNoticeView({ id, readOnly = false, onBack }) {
  const { user } = useAuth();

  const [notice, setNotice]   = useState(null);
  const [loading, setLoading] = useState(true);

  const [comment, setComment]           = useState('');
  const [actionFile, setActionFile]     = useState(null);
  // The day the work was actually done. Defaults to today — the common case is
  // acting on the day you say you acted.
  const [submissionDate, setSubmissionDate] = useState(todayDate());
  const [decision, setDecision]         = useState('');
  const [submitting, setSubmitting]     = useState(false);
  const [actionErrors, setActionErrors] = useState({});
  // Bumped after a rejected file so the input — which React cannot clear by
  // value — is thrown away and remounted empty, the way Compliance View does.
  const [fileKey, setFileKey] = useState(0);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await getLegalNoticeById(id);
      if (res.data?.status_code === 200) {
        setNotice(res.data.response);
      } else {
        onBack?.(false);
      }
    } catch (err) {
      console.error(err);
      onBack?.(false);
    } finally {
      setLoading(false);
    }
    // onBack is deliberately not a dependency: the host re-creates it on every
    // render, and depending on it would re-fetch the notice on each one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => { load(); }, [load]);

  /**
   * Opens a stored document in a new tab.
   *
   * A handler rather than an <a href>, matching handleDownload in Compliance
   * View — the field it hangs off is a styled div, not a link, so that the
   * read-only inputs and the attachment beside them are the same control.
   */
  function handleDownload(url, fileName) {
    if (!fileName) {
      alert('File Not Attached.');
      return;
    }
    window.open(url, '_blank');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <i className="fas fa-spinner fa-spin text-3xl text-primary" />
      </div>
    );
  }

  if (!notice) return null;

  const history = notice.actionList || [];
  const kind = actionKind(notice);
  // The ACTION card only. The history above it is shown to everybody.
  //
  // readOnly settles it for the reader roles; canAct settles it for everyone
  // else. Hidden is not the rule — the server checks the same thing again on
  // save, and it is the one that counts.
  const showActionCard = !readOnly && canAct(notice, user);
  const isSubmitForm = kind === 'submit';

  const attachFilename = extractFilename(notice.noticeAttachment);

  function validateAction() {
    const e = {};

    if (isSubmitForm) {
      if (!comment.trim()) e.comment = 'Comment is required';
      if (!actionFile) e.attachment = 'Attachment is required';
      // Checked again here, not only when the file was picked: the same rule
      // the Add form applies, and the same the server enforces.
      else if (fileError(actionFile)) e.attachment = fileError(actionFile);
    } else {
      if (!decision) e.decision = 'Please select an action (APPROVE or REJECT).';
      if (!comment.trim()) e.comment = 'Please enter a comment.';
    }
    setActionErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleActionSave() {
    if (!validateAction()) return;

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('mstId', notice.id);
      fd.append('authEmpCode', user?.empCode || '');
      fd.append('comment', comment.trim());
      if (isSubmitForm) {
        fd.append('submissionDate', submissionDate);
        fd.append('actAttachment1', actionFile);
      } else {
        fd.append('decision', decision);
      }

      const res = await saveLegalNoticeAction(fd);
      const obj = res.data;
      if (obj?.status_code === 200) {
        await Swal.fire({
          title: obj.message || 'Legal Notice Action Submitted Successfully.',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false,
        });
        onBack?.(true);
      } else {
        await Swal.fire({
          title: obj?.message || 'Action could not be saved',
          icon: 'warning',
          timer: 3000,
        });
      }
    } catch (err) {
      console.error(err);
      await Swal.fire({
        title: err?.response?.data?.message || 'An error occurred. Please try again.',
        icon: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">

      <input type="hidden" id="legal_mst_id" value={notice.id} />

      {/* 1. Legal Notice Details */}
      <div className="card">
        <div className="card-header-primary">
          <h3><i className="fas fa-tasks" /> 1.LEGAL NOTICE DETAILS</h3>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-5 gap-y-4">

            {/* Compliance View's grid, slot for slot: 2/2/4/4, then Due Date
                and Attachment in the very columns they occupy there.
                Frequency's slot is left empty rather than filled for the sake
                of it — a legal notice has no frequency, and the subject that
                used to stand there is now composed by the server out of these
                two act fields, so showing it would only repeat them.
                Nothing else is here either: who raised it and when is the first
                line of the Action History below, and its status is the last. */}

            <div className="form-group lg:col-span-2">
              <label className="form-label">Legal Notice No:</label>
              <input className="form-input" value={notice.noticeNo || ''} readOnly id="legal_notice_no" />
            </div>

            <div className="form-group lg:col-span-2">
              <label className="form-label">Plant Code:</label>
              <input className="form-input" value={notice.plantCode ?? ''} readOnly id="legal_plant_code" />
            </div>

            <div className="form-group lg:col-span-4">
              <label className="form-label">Legal Notice Category:</label>
              <input className="form-input" value={notice.noticeCategory || ''} readOnly id="legal_category" />
            </div>

            <div className="form-group lg:col-span-4">
              <label className="form-label">Legal Notice Subcategory:</label>
              <input className="form-input" value={notice.noticeSubCategory || ''} readOnly id="legal_subcategory" />
            </div>

            <div className="form-group lg:col-span-4">
              <label className="form-label">Due Date:</label>
              <input className="form-input" value={notice.dueDate || ''} readOnly id="legal_due_date" />
            </div>

            <div className="form-group lg:col-span-4">
              <label className="form-label">Attachment :</label>
              <div
                className="form-input flex items-center gap-2 cursor-pointer text-xs px-3"
                onClick={() => handleDownload(getLegalNoticeDownloadUrl(notice.id), attachFilename)}
                id="legal_attachment"
                title="Click to download"
              >
                <i className="fas fa-download text-gray-700" />
                <span className="truncate">{attachFilename || 'No File Attach'}</span>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* 2. Action History — shown to every role, the read-only ones included.
          Where a notice has got to, and who said what about it on the way, is
          the substance of reading one: without it a reader gets a status and no
          account of how it was reached. Seeing costs nothing — acting is gated
          separately, by the ACTION card below, which readers never get. */}
      <div className="card" id="legal_action_history">
        <div className="card-header-primary">
          <h3><i className="fas fa-tasks" /> 2.ACTION HISTORY</h3>
        </div>
        <div className="p-5 overflow-x-auto">
          <table className="data-table" id="legalNoticeActionHistory">
            <thead>
              <tr>
                {['No', 'Name of Authority', 'Date & Time', 'Attachment', 'Remark', 'Action'].map((h) => (
                  <th key={h} className="text-center">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">No action history</td></tr>
              ) : (
                history.map((row, i) => {
                  const fname = extractFilename(row.actAttachment);
                  const look = legalActionInfo(row);
                  return (
                    <tr key={row.id}>
                      <td>{i + 1}</td>
                      <td>{row.authEmpName || '-'}</td>
                      <td>{`${row.regDate || ''} ${row.regTime || ''}`.trim() || '-'}</td>
                      <td>
                        {fname && fname !== '-' ? (
                          <a
                            href={getLegalNoticeActionDownloadUrl(row.id)}
                            target="_blank" rel="noreferrer"
                            className="text-primary hover:underline flex items-center gap-1 justify-center"
                          >
                            {fname} <i className="fas fa-download text-xs" />
                          </a>
                        ) : '-'}
                      </td>
                      <td>
                        {/* The only cell here that can hold a paragraph: the
                            opening row's remark is the description from the
                            Add form, up to 2000 characters. .data-table td is
                            whitespace-nowrap, which would run that off the
                            side of the screen, so this one cell wraps and is
                            held to a readable width. Short remarks are
                            unaffected — the box only grows to what it holds. */}
                        <span className="inline-block max-w-[360px] whitespace-pre-wrap break-words text-left align-middle">
                          {row.comment || '-'}
                        </span>
                      </td>
                      <td>
                        <StatusBadge
                          status={row.status}
                          labelOverride={look.label}
                          variantOverride={look.variant}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Action section */}
      {showActionCard && (
        <div className="card" id="legal_action_card_div">
          <div className="card-header-primary">
            <h3><i className="fas fa-tasks" /> 3.ACTION</h3>
          </div>
          <div className="p-5">
            {isSubmitForm ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
                <div className="form-group">
                  <label className="block text-[#3482AE] font-bold !text-[12px] mb-2 uppercase tracking-wide">DATE OF SUBMISSION</label>
                  {/* Same control as the Add form and Assign Compliance. */}
                  <div className="relative">
                    <input
                      type="text"
                      className="form-input text-xs h-9 bg-white cursor-pointer pr-7"
                      value={submissionDate}
                      readOnly
                      placeholder="YYYY-MM-DD"
                      onClick={() => {
                        const el = document.getElementById('hidden_legal_submission_date');
                        if (el) {
                          try { el.showPicker(); } catch { /* not user-activated */ }
                        }
                      }}
                    />
                    <input
                      type="date"
                      id="hidden_legal_submission_date"
                      className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
                      value={submissionDate}
                      onChange={(e) => {
                        if (e.target.value) setSubmissionDate(e.target.value);
                      }}
                    />
                    <i className="fas fa-calendar-alt absolute right-2 top-1/2 -translate-y-1/2 text-[#3482AE] text-[12px] pointer-events-none" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="block text-[#3482AE] font-bold !text-[12px] mb-2 uppercase tracking-wide">UPLOAD ATTACHMENT</label>
                  <input
                    key={fileKey}
                    type="file"
                    accept={ACCEPT}
                    className="form-input text-xs h-9 bg-white cursor-pointer"
                    onChange={(e) => {
                      const file = e.target.files[0] || null;
                      const problem = fileError(file);
                      // A rejected file is not kept: leaving it in state would
                      // show its name under an error, as though it were still
                      // going.
                      if (problem) setFileKey((k) => k + 1);
                      setActionFile(problem ? null : file);
                      setActionErrors((prev) => ({ ...prev, attachment: problem }));
                    }}
                  />
                  {actionErrors.attachment
                    ? <p className="text-red-500 text-xs mt-1">{actionErrors.attachment}</p>
                    : <p className="text-xs text-gray-400 mt-1">{FILE_HINT}</p>}
                </div>
                <div className="form-group">
                  <label className="block text-[#3482AE] font-bold !text-[12px] mb-2 uppercase tracking-wide">COMMENT</label>
                  <textarea
                    className="form-input text-xs h-24 pt-2 resize-y min-h-[60px]"
                    value={comment}
                    onChange={(e) => setComment(e.target.value.slice(0, COMMENT_MAX))}
                    maxLength={COMMENT_MAX}
                    placeholder="ENTER COMMENT ..."
                  />
                  <div className="flex items-start justify-between gap-2 mt-1">
                    <p className="text-red-500 text-xs">{actionErrors.comment || ''}</p>
                    <span className="text-[12px] text-gray-400 shrink-0 leading-4">
                      {comment.length}/{COMMENT_MAX}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="form-group">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                    <span className="text-[#3482AE] font-bold !text-[12px] uppercase tracking-wide shrink-0">Action :</span>
                    <label className="flex items-center gap-1.5 cursor-pointer font-bold !text-[12px] uppercase tracking-wide text-green-600">
                      <input
                        type="radio"
                        name="sel_legal_action"
                        value="1"
                        checked={decision === '1'}
                        onChange={(e) => { setDecision(e.target.value); setActionErrors((prev) => ({ ...prev, decision: '' })); }}
                        className="cursor-pointer"
                      />
                      APPROVE
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer font-bold !text-[12px] uppercase tracking-wide text-red-600">
                      <input
                        type="radio"
                        name="sel_legal_action"
                        value="2"
                        checked={decision === '2'}
                        onChange={(e) => { setDecision(e.target.value); setActionErrors((prev) => ({ ...prev, decision: '' })); }}
                        className="cursor-pointer"
                      />
                      REJECT
                    </label>
                  </div>
                  {actionErrors.decision && <p className="text-red-500 text-xs mt-1">{actionErrors.decision}</p>}
                  {/* {decision === '2' && (
                    // Said before the click, not after: unlike a compliance
                    // rejection this is not the end of the road — the notice
                    // goes straight back to the Plant HR to act on again.
                    <p className="text-[11px] text-gray-500 mt-1.5">
                      A rejected legal notice goes back to the Plant HR to act on again.
                    </p>
                  )} */}
                </div>

                <div className="form-group flex items-start gap-4">
                  <label className="text-[#3482AE] font-bold !text-[12px] uppercase tracking-wide shrink-0 pt-2">
                    COMMENT <span className="text-red-500">*</span> :
                  </label>
                  <div className="flex-1">
                    <textarea
                      className="form-input text-xs h-44 resize-y min-h-[60px] pt-2"
                      value={comment}
                      onChange={(e) => { setComment(e.target.value.slice(0, COMMENT_MAX)); setActionErrors((prev) => ({ ...prev, comment: '' })); }}
                      maxLength={COMMENT_MAX}
                      placeholder="ENTER COMMENT ..."
                    />
                    <div className="flex items-start justify-between gap-2 mt-1">
                      <p className="text-red-500 text-xs">{actionErrors.comment || ''}</p>
                      <span className="text-[12px] text-gray-400 shrink-0 leading-4">
                        {comment.length}/{COMMENT_MAX}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-[#F8F9FA] border-t border-gray-200 -mx-5 -mb-5 mt-2 py-3 px-5 flex justify-center gap-2 rounded-b">
              <button
                onClick={handleActionSave}
                disabled={submitting}
                className="bg-[#3482AE] hover:bg-[#2c78a6] text-white px-5 py-1.5 rounded text-xs font-bold uppercase tracking-wider min-w-[80px]"
              >
                {submitting ? <span className="loading-spinner h-3 w-3" /> : 'SUBMIT'}
              </button>
              <button
                onClick={() => onBack?.(false)}
                disabled={submitting}
                className="bg-[#D9534F] hover:bg-[#c9302c] text-white px-5 py-1.5 rounded text-xs font-bold uppercase tracking-wider min-w-[80px]"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
