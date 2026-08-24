import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useAuth } from '../../context/AuthContext';
import { useShowBackButton } from '../../hooks/useShowBackButton';
import {
  getComplianceById, getActionHistory, saveComplianceAction, getDownloadUrl,
} from '../../services/complianceService';
import StatusBadge from '../../components/ui/StatusBadge';
import { getDueDate, todayDate, currentTime, extractFilename } from '../../utils/formatters';
import { LS_KEYS } from '../../utils/constants';
import { ACCEPT, FILE_HINT, fileError } from '../../utils/attachments';

// Pending-row authLevels each dashboard may act on — keeps a multi-role account
// (e.g. Comp Admin + Comp Head) from acting on the wrong step.
//   1/4 = doer submit / re-submit   2 = approver   3 = final approver
const DASHBOARD_AUTH_LEVELS = {
  '/comp-admin/': [1, 4],
  '/plant-hr/':   [1, 4],
  '/comp-head/':  [2],
  '/corp-hr/':    [2],
  '/hcm-head/':   [3],
};

function allowedLevelsForCurrentDashboard() {
  const path = window.location.pathname;
  const key = Object.keys(DASHBOARD_AUTH_LEVELS).find((k) => path.includes(k));
  return key ? DASHBOARD_AUTH_LEVELS[key] : null; // null = no dashboard restriction
}

// Status labels for the Action History table (0 reads "Pending", 4 "Re-Submitted").
const ACTION_HISTORY_STATUS = {
  0:  { label: 'Pending',                variant: 'warning' },
  1:  { label: 'Approved',               variant: 'success' },
  2:  { label: 'Rejected',               variant: 'danger'  },
  '-2': { label: 'Rejected',             variant: 'danger'  },
  3:  { label: 'Submitted',              variant: 'info'    },
  4:  { label: 'Re-Submitted',           variant: 'info'    },
  5:  { label: 'Pending',                variant: 'warning' },
  6:  { label: 'Compliance Assigned',    variant: 'primary' },
  11: { label: 'Approval Pending',       variant: 'warning' },
  22: { label: 'Final Approval Pending', variant: 'warning' },
};
function actionHistoryStatus(status) {
  return ACTION_HISTORY_STATUS[Number(status)] || { label: 'Approved', variant: 'success' };
}

// Matches the DB comment column width (500) — keep the two in sync.
const COMMENT_MAX = 500;

/**
 * Props:
 *   showAction — render the action form when this user has a pending row
 *   embedded   — rendered inside a dashboard card (ComplianceListPage) instead of
 *                on its own route: drops the page title row / Back button, since
 *                the host card supplies both
 *   onBack     — where "back" goes in embedded mode (defaults to history back)
 */
export default function ComplianceView({ showAction = false, embedded = false, onBack }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  // Set by the navbar bell: the dashboard this record belongs to. Arriving that
  // way there may be no history to go back to, so Back is always offered.
  const backTo = useLocation().state?.backTo;
  const showBack = useShowBackButton() || Boolean(backTo);

  const [comp, setComp] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showActionCard, setShowActionCard] = useState(false);
  const [pendingRowStatus, setPendingRowStatus] = useState(null);
  const [pendingRowAuthLevel, setPendingRowAuthLevel] = useState(null);

  const [comment, setComment] = useState('');
  const [compDate, setCompDate] = useState(todayDate());
  const [actionFile, setActionFile] = useState(null);
  // Bumped after a rejected file so the input — which React cannot clear by
  // value — is thrown away and remounted empty, the way Assign Compliance does.
  const [fileKey, setFileKey]       = useState(0);
  const [selectedAction, setSelectedAction] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionErrors, setActionErrors] = useState({});

  const id = localStorage.getItem(LS_KEYS.ID);
  const userLevel = Number(localStorage.getItem(LS_KEYS.GLOBEL_LEVEL) || 1);
  const globalEmpCode = localStorage.getItem(LS_KEYS.GLOBAL_EMP_CODE);

  // Which form to show comes from the pending row's authLevel, not the user's
  // role — a multi-role account can appear twice in the same flow.
  const isSubmitForm =
    pendingRowAuthLevel === 1 || pendingRowAuthLevel === 4;

  // Doers (1) and re-submit doers (4) both act at level 1; approvers echo their row.
  const getNextAuthLevel = useCallback(() => {
    if (pendingRowAuthLevel == null) return userLevel;
    if (pendingRowAuthLevel === 4) return 1;
    return pendingRowAuthLevel;
  }, [pendingRowAuthLevel, userLevel]);

  // Embedded: hand control back to the host card. Standalone: history back.
  // `changed` tells the host whether anything was actually saved — a plain
  // "back" after only reading the record should not cost it a list refetch.
  const goBack = useCallback((changed = false) => {
    if (onBack) onBack(changed);
    // Opened from the navbar bell, which says which dashboard to return to.
    // navigate(-1) would land wherever the user happened to be instead.
    else if (backTo) navigate(backTo, { replace: true });
    else navigate(-1);
  }, [onBack, navigate, backTo]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await getComplianceById(id);
      if (res.data.status_code === 200) {
        const c = res.data.response;
        setComp(c);
        localStorage.setItem(LS_KEYS.ID_COMP, c.id);
        // Opening the record deliberately does NOT clear its bell entry.
        //
        // It used to: "reading the record IS reading its notification, however
        // it was opened". But a notification the user never saw is not one they
        // have read — opening a rejected compliance from the list to see what
        // happened silently consumed the very entry that was there to tell them,
        // and the bell was empty by the time they looked at it. The mail flow
        // does not delete a mail because the record behind it was viewed in the
        // portal either.
        //
        // The entry is cleared by clicking it in the bell (openCompliance), and
        // an action item disappears on its own once the user acts and its action
        // row stops waiting.

        const hRes = await getActionHistory(c.id);
        const actions = hRes.data?.response || [];
        setHistory(actions);
        checkPendingStatus(actions);
      } else {
        goBack();
      }
    } catch (err) {
      console.error(err);
      goBack();
    } finally {
      setLoading(false);
    }
  }, [id, goBack]);

  useEffect(() => { load(); }, [load]);

  function checkPendingStatus(actions) {
    if (!showAction) return;
    // Waiting states only — 3/4 are completed doer actions, not pending.
    const pendingSet = [0, 5, 11, 22];
    const allowed = allowedLevelsForCurrentDashboard();

    // Newest-first: this user's latest waiting row that belongs to this dashboard.
    for (let i = actions.length - 1; i >= 0; i--) {
      const row = actions[i];
      const rowLevel = Number(row.authLevel);
      if (Number(row.authEmpCode) === Number(globalEmpCode) &&
          pendingSet.includes(Number(row.status)) &&
          (allowed === null || allowed.includes(rowLevel))) {
        setShowActionCard(true);
        setPendingRowStatus(Number(row.status));
        setPendingRowAuthLevel(rowLevel);
        return;
      }
    }
    setShowActionCard(false);
    setPendingRowStatus(null);
    setPendingRowAuthLevel(null);
  }

  function validateAction() {
    const e = {};

    if (isSubmitForm) {
      if (!comment.trim()) e.comment = 'Comment is required';
      if (!actionFile) e.attachment = 'Attachment is required';
      // Checked again here, not only when the file was picked: the same rule
      // the Assign Compliance form applies, and the same the server enforces.
      else if (fileError(actionFile)) e.attachment = fileError(actionFile);
    } else {
      if (!selectedAction) e.selectedAction = 'Please select an action (APPROVE or REJECT).';
      if (!comment.trim()) e.comment = 'Please enter a comment.';
    }
    setActionErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleActionSave() {
    if (!validateAction()) return;

    setSubmitting(true);
    try {
      const regDate = todayDate();
      const regTime = currentTime();
      const nextLevel = getNextAuthLevel();

      const fd = new FormData();
      fd.append('mstId', comp.id);
      fd.append('authEmpCode', globalEmpCode);
      fd.append('emp_code', globalEmpCode);
      fd.append('authLevel', String(nextLevel));

      if (comp.plantCode) fd.append('plantCode', comp.plantCode);

      fd.append('comment', comment.trim());
      fd.append('regDate', regDate);
      fd.append('regTime', regTime);
      fd.append('closingDate', regDate);
      fd.append('closingTime', regTime);
      fd.append('closeByEmpName', localStorage.getItem(LS_KEYS.GLOBAL_EMP_NAME));

      if (isSubmitForm) {
        fd.append('dateOfCompliance', compDate);
        fd.append('status', '3');
        fd.append('actAttachment2', actionFile);
      } else {
        fd.append('dateOfCompliance', '');
        fd.append('status', selectedAction);
      }

      const res = await saveComplianceAction(fd);
      const obj = res.data;
      if (obj.status_code === 200) {
        let displayMessage = obj.message || 'Compliance Action Saved Successfully.';
        if (displayMessage === displayMessage.toUpperCase()) {
          displayMessage = displayMessage.toLowerCase().replace(/(^\w|\s\w)/g, (m) => m.toUpperCase());
        }
        await Swal.fire({ title: displayMessage, icon: 'success', timer: 2000, showConfirmButton: false });
        goBack(true);
      } else {
        let displayMessage = obj.message || '';
        if (displayMessage === displayMessage.toUpperCase()) {
          displayMessage = displayMessage.toLowerCase().replace(/(^\w|\s\w)/g, (m) => m.toUpperCase());
        }
        await Swal.fire({ title: displayMessage, icon: 'warning', timer: 2000 });
      }
    } catch (err) {
      console.error(err);
      await Swal.fire({ title: 'An error occurred. Please try again.', icon: 'error' });
    } finally {
      setSubmitting(false);
    }
  }

  function handleDownload(compId, filePath) {
    const filename = extractFilename(filePath);
    if (!filename || filename === 'No File Attach') { alert('File Not Attached.'); return; }
    
    let folderId = compId;
    if (filePath) {
      const parts = filePath.split(/[/\\]/);
      if (parts.length >= 2) {
        const potentialId = parts[parts.length - 2];
        if (potentialId && !isNaN(potentialId) && potentialId.trim() !== '') {
          folderId = potentialId;
        }
      }
    }
    window.open(getDownloadUrl(folderId, filename), '_blank');
  }

  const isAsWhen = comp?.compFrequency === 'AS & WHEN';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <i className="fas fa-spinner fa-spin text-3xl text-primary" />
      </div>
    );
  }

  if (!comp) return null;

  const attachFilename = extractFilename(comp.actAttachment);

  return (
    <div className="space-y-5">
      {!embedded && (
        <div className="flex items-center justify-between">
          <h1 className="text-[#3482AE] font-bold text-sm uppercase tracking-wider">
            Compliance View
          </h1>
          {showBack && (
            <button
              onClick={() => goBack()}
              className="back-button"
            >
              <i className="fas fa-chevron-left" /> Back
            </button>
          )}
        </div>
      )}

      <input type="hidden" id="mst_id" value={comp.id} />

      {/* 1. Compliance Act Details */}
      <div className="card">
        <div className="card-header-primary">
          <h3><i className="fas fa-tasks" /> 1.COMPLIANCE ACT DETAILS</h3>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-5 gap-y-4">

            <div className="form-group lg:col-span-2">
              <label className="form-label">Compliance Sr. No:</label>
              <input className="form-input" value={comp.compSrNo || ''} readOnly id="comp_sr_no" />
            </div>

            <div className="form-group lg:col-span-2">
              <label className="form-label">Plant Code:</label>
              <input className="form-input" value={comp.plantCode || ''} readOnly id="plant_code" />
            </div>

            <div className="form-group lg:col-span-4">
              <label className="form-label">Compliance Category:</label>
              <input className="form-input" value={comp.compActType || ''} readOnly id="comp_act" />
            </div>

            <div className="form-group lg:col-span-4">
              <label className="form-label">Compliance Subcategory:</label>
              <input className="form-input" value={comp.compActSubType || ''} readOnly id="comp_desc" />
            </div>

            <div className="form-group lg:col-span-4">
              <label className="form-label">Frequency:</label>
              <input className="form-input" value={comp.compFrequency || ''} readOnly id="act_freq" />
            </div>

            {isAsWhen ? (
               <>
                <div className="form-group lg:col-span-2" id="start_Date_Div">
                  <label className="form-label">Start Date:</label>
                  <input className="form-input" value={comp.firstDueDate || ''} readOnly id="start_date" />
                </div>
                <div className="form-group lg:col-span-2" id="end_Date_Div">
                  <label className="form-label">End Date:</label>
                  <input className="form-input" value={comp.lastDueDate || ''} readOnly id="end_date" />
                </div>
              </>
            ) : (
              <div className="form-group lg:col-span-4" id="due_Date_Div">
                <label className="form-label">Due Date:</label>
                <input className="form-input" value={getDueDate(comp)} readOnly id="first_due_date" />
              </div>
            )}

            <div className="form-group lg:col-span-4">
              <label className="form-label">Attachment :</label>
              <div
                className="form-input flex items-center gap-2 cursor-pointer bg-[#E6F2FF] transition-colors text-xs px-3"
                onClick={() => handleDownload(comp.id, comp.actAttachment)}
                id="comp_act_attachment"
                title="Click to download"
              >
                <i className="fas fa-download text-gray-700" />
                <span className="truncate">{attachFilename || 'No File Attach'}</span>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* 2. Action History */}
      <div className="card" id="action_history">
        <div className="card-header-primary">
          <h3><i className="fas fa-tasks" /> 2.ACTION HISTORY</h3>
        </div>
        <div className="p-5 overflow-x-auto">
          <table className="data-table" id="complianceActionHistory">
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
                  const fname = extractFilename(row.actAttachmentAction);
                  return (
                    <tr key={row.id}>
                      <td>{i + 1}</td>
                      <td>{row.compActionAuthority?.employeeFname} {row.compActionAuthority?.employeeLname}</td>
                      <td>{row.regDate} {row.regTime}</td>
                      <td>
                        {fname && fname !== '-' ? (
                          <a
                            href={getDownloadUrl(row.id, fname)}
                            target="_blank" rel="noreferrer"
                            className="text-primary hover:underline flex items-center gap-1 justify-center"
                          >
                            {fname} <i className="fas fa-download text-xs" />
                          </a>
                        ) : '-'}
                      </td>
                      <td>{row.comment || '-'}</td>
                      <td>
                        <StatusBadge
                          status={row.status}
                          labelOverride={actionHistoryStatus(row.status).label}
                          variantOverride={actionHistoryStatus(row.status).variant}
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
      {showAction && showActionCard && pendingRowStatus !== null && (
        <div className="card" id="comp_admin_action_card_div">
          <div className="card-header-primary">
            <h3><i className="fas fa-tasks" /> 3.ACTION</h3>
          </div>
          <div className="p-5">
            {isSubmitForm ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
                <div className="form-group">
                  <label className="block text-[#3482AE] font-bold !text-[12px] mb-2 uppercase tracking-wide">DATE OF COMPLIANCE</label>
                  <input
                    type="date"
                    className="form-input text-xs h-9"
                    value={compDate}
                    onChange={(e) => setCompDate(e.target.value)}
                  />
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
                        name="sel_action"
                        value="1"
                        checked={selectedAction === '1'}
                        onChange={(e) => { setSelectedAction(e.target.value); setActionErrors((prev) => ({ ...prev, selectedAction: '' })); }}
                        className="cursor-pointer"
                      />
                      APPROVE
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer font-bold !text-[12px] uppercase tracking-wide text-red-600">
                      <input
                        type="radio"
                        name="sel_action"
                        value="2"
                        checked={selectedAction === '2'}
                        onChange={(e) => { setSelectedAction(e.target.value); setActionErrors((prev) => ({ ...prev, selectedAction: '' })); }}
                        className="cursor-pointer"
                      />
                      REJECT
                    </label>
                  </div>
                  {actionErrors.selectedAction && <p className="text-red-500 text-xs mt-1">{actionErrors.selectedAction}</p>}
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
                onClick={() => goBack()}
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