import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useAuth } from '../../context/AuthContext';
import { useShowBackButton } from '../../hooks/useShowBackButton';
import {
  getComplianceById, getActionHistory, saveComplianceAction, getDownloadUrl,
} from '../../services/complianceService';
import StatusBadge from '../../components/ui/StatusBadge';
import { getDueDate, todayDate, currentTime, extractFilename } from '../../utils/formatters';
import { LS_KEYS } from '../../utils/constants';

// Which pending-row authLevels each dashboard is allowed to act on. The Comp Admin
// view only surfaces the doer steps, the Comp Head view only the approval step,
// etc. It matters for multi-role accounts (e.g. a user
// who is BOTH Comp Admin and Comp Head): in Flow 1 the record reaches that person
// twice, and the approve action (authLevel 2) must appear ONLY under the Comp Head
// dashboard — never under the Comp Admin dashboard.
//   authLevel 1/4 = doer submit / re-submit   2 = approver   3 = final approver
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

// Status labels for the Action History table — a pending row reads "PENDING"
// (not "Submission Pending") and status 4 reads "Re-Submitted".
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

export default function ComplianceView({ showAction = false }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const showBack = useShowBackButton();

  const [comp, setComp] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showActionCard, setShowActionCard] = useState(false);
  const [pendingRowStatus, setPendingRowStatus] = useState(null);
  const [pendingRowAuthLevel, setPendingRowAuthLevel] = useState(null);

  const [comment, setComment] = useState('');
  const [compDate, setCompDate] = useState(todayDate());
  const [actionFile, setActionFile] = useState(null);
  const [selectedAction, setSelectedAction] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionErrors, setActionErrors] = useState({});

  const id = localStorage.getItem(LS_KEYS.ID);
  const userLevel = Number(localStorage.getItem(LS_KEYS.GLOBEL_LEVEL) || 1);
  const globalEmpCode = localStorage.getItem(LS_KEYS.GLOBAL_EMP_CODE);

  // The step is identified by the PENDING ROW's authLevel — the value the backend
  // stamped on the action row it created for this user — NOT by the user's role.
  // This is essential for multi-role accounts (e.g. a user who is both COMP ADMIN
  // and COMP HEAD): the same person appears twice in Flow 1, and only the row's
  // authLevel says whether they are the doer (submit) or the approver now.
  //   authLevel 1 -> doer submits evidence (Comp Admin / Plant HR), status -> 3
  //   authLevel 4 -> doer re-submits after a rejection, status -> 3
  //   authLevel 2 -> approver (Comp Head / Corp HR), Approve/Reject
  //   authLevel 3 -> final approver (HCM Head), Approve/Reject
  // Flow 1 (CA):  Comp Head -> Comp Admin -> Comp Head -> HCM Head
  // Flow 2 (PHR): Comp Head -> Plant HR   -> Corp HR   -> HCM Head
  const isSubmitForm =
    pendingRowAuthLevel === 1 || pendingRowAuthLevel === 4;

  // Each actor reports its OWN authLevel back; the backend routes onward from the
  // flow config + (authLevel, status). Doers (1) and re-submit doers (4) both act
  // at level 1; approvers echo their row's level (2 or 3).
  const getNextAuthLevel = useCallback(() => {
    if (pendingRowAuthLevel == null) return userLevel;
    if (pendingRowAuthLevel === 4) return 1; // re-submit doer acts at level 1
    return pendingRowAuthLevel;
  }, [pendingRowAuthLevel, userLevel]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await getComplianceById(id);
      if (res.data.status_code === 200) {
        const c = res.data.response;
        setComp(c);
        localStorage.setItem(LS_KEYS.ID_COMP, c.id);

        const hRes = await getActionHistory(c.id);
        const actions = hRes.data?.response || [];
        setHistory(actions);
        checkPendingStatus(actions);
      } else {
        navigate(-1);
      }
    } catch (err) {
      console.error(err);
      navigate(-1);
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);

  function checkPendingStatus(actions) {
    if (!showAction) return;
    // ONLY genuinely-waiting states — NOT status 3 (Submitted) or 4 (Re-Submitted),
    // which are COMPLETED doer actions. Including 4 wrongly re-opened the form on a
    // user's old re-submitted row after the record had moved on to the next approver.
    //   0 = submission pending, 5 = overdue, 11 = level approval pending, 22 = final.
    const pendingSet = [0, 5, 11, 22];
    const allowed = allowedLevelsForCurrentDashboard();

    // The current pending row is this user's LATEST row still in a waiting state, so
    // scan newest-first and require the row's authLevel to belong to THIS dashboard.
    for (let i = actions.length - 1; i >= 0; i--) {
      const row = actions[i];
      const rowLevel = Number(row.authLevel);
      if (Number(row.authEmpCode) === Number(globalEmpCode) &&
          pendingSet.includes(Number(row.status)) &&
          (allowed === null || allowed.includes(rowLevel))) {
        setShowActionCard(true);
        setPendingRowStatus(Number(row.status));
        setPendingRowAuthLevel(rowLevel);
        // console.log(`Action card shown — status=${row.status}, authLevel=${rowLevel}, dashboard=${window.location.pathname}`);
        return;
      }
    }
    // console.log(`No action for ${globalEmpCode} on ${window.location.pathname} (allowed levels=${JSON.stringify(allowed)}). Rows:`,
    // actions.map((r) => ({ authEmpCode: r.authEmpCode, authLevel: r.authLevel, status: r.status })));
    setShowActionCard(false);
    setPendingRowStatus(null);
    setPendingRowAuthLevel(null);
  }

  function validateAction() {
    const e = {};

    if (isSubmitForm) {
      if (!comment.trim()) e.comment = 'Comment is required';
      if (!actionFile) e.attachment = 'Attachment is required';
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

      // console.log(`Submitting: authLevel=${nextLevel}, emp_code=${globalEmpCode}, pendingStatus=${pendingRowStatus}`);

      const res = await saveComplianceAction(fd);
      // console.log("Backend Response:", res.data);

      const obj = res.data;
      if (obj.status_code === 200) {
        let displayMessage = obj.message || 'Compliance Action Saved Successfully.';
        if (displayMessage === displayMessage.toUpperCase()) {
          displayMessage = displayMessage.toLowerCase().replace(/(^\w|\s\w)/g, (m) => m.toUpperCase());
        }
        await Swal.fire({ title: displayMessage, icon: 'success', timer: 2000, showConfirmButton: false });
        navigate(-1);
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-[#3482AE] font-bold text-sm uppercase tracking-wider">
          Compliance View
        </h1>
        {showBack && (
          <button
            onClick={() => navigate(-1)}
            className="back-button"
          >
            <i className="fas fa-chevron-left" /> Back
          </button>
        )}
      </div>

      {/* Hidden mst_id */}
      <input type="hidden" id="mst_id" value={comp.id} />

      {/* 1. Compliance Act Details */}
      <div className="bg-white rounded border border-gray-200">
        <div className="px-5 py-3 border-b border-gray-200">
          <h3 className="text-[#3482AE] font-bold text-xs uppercase tracking-wider">1.COMPLIANCE ACT DETAILS</h3>
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
      <div className="bg-white rounded border border-gray-200" id="action_history">
        <div className="px-5 py-3 border-b border-gray-200">
          <h3 className="text-[#3482AE] font-bold text-xs uppercase tracking-wider">2.ACTION HISTORY</h3>
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
        <div className="bg-white rounded border border-gray-200" id="comp_admin_action_card_div">
          <div className="px-5 py-3 border-b border-gray-200">
            <h3 className="text-[#3482AE] font-bold text-xs uppercase tracking-wider">3.ACTION</h3>
          </div>
          <div className="p-5">
            {isSubmitForm ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
                <div className="form-group">
                  <label className="block text-[#3482AE] font-bold !text-[11px] mb-2 uppercase tracking-wide">DATE OF COMPLIANCE</label>
                  <input
                    type="date"
                    className="form-input text-xs h-9"
                    value={compDate}
                    onChange={(e) => setCompDate(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="block text-[#3482AE] font-bold !text-[11px] mb-2 uppercase tracking-wide">UPLOAD ATTACHMENT</label>
                  <input
                    type="file"
                    className="form-input text-xs h-9 bg-white cursor-pointer"
                    onChange={(e) => setActionFile(e.target.files[0] || null)}
                  />
                  {actionErrors.attachment && <p className="text-red-500 text-xs mt-1">{actionErrors.attachment}</p>}
                </div>
                <div className="form-group">
                  <label className="block text-[#3482AE] font-bold !text-[11px] mb-2 uppercase tracking-wide">ENTER COMMENT</label>
                  <textarea
                    className="form-input text-xs h-9 py-1.5 resize-y min-h-[36px]"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="ENTER ..."
                  />
                  {actionErrors.comment && <p className="text-red-500 text-xs mt-1">{actionErrors.comment}</p>}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="form-group">
                  <label className="block text-[#3482AE] font-bold !text-[11px] mb-2 uppercase tracking-wide">Action :</label>
                  <div className="flex items-center gap-4 text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer font-bold">
                      <input
                        type="radio"
                        name="sel_action"
                        value="1"
                        checked={selectedAction === '1'}
                        onChange={(e) => { setSelectedAction(e.target.value); setActionErrors((prev) => ({ ...prev, selectedAction: '' })); }}
                        className="cursor-pointer"
                      />
                      Approve
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer font-bold">
                      <input
                        type="radio"
                        name="sel_action"
                        value="2"
                        checked={selectedAction === '2'}
                        onChange={(e) => { setSelectedAction(e.target.value); setActionErrors((prev) => ({ ...prev, selectedAction: '' })); }}
                        className="cursor-pointer"
                      />
                      Reject
                    </label>
                  </div>
                  {actionErrors.selectedAction && <p className="text-red-500 text-xs mt-1">{actionErrors.selectedAction}</p>}
                </div>

                <div className="form-group">
                  <label className="block text-[#3482AE] font-bold !text-[11px] mb-2 uppercase tracking-wide">ENTER COMMENT <span className="text-red-500">*</span></label>
                  <textarea
                    className="form-input text-xs h-16 resize-y min-h-[36px]"
                    value={comment}
                    onChange={(e) => { setComment(e.target.value); setActionErrors((prev) => ({ ...prev, comment: '' })); }}
                    placeholder="ENTER ..."
                  />
                  {actionErrors.comment && <p className="text-red-500 text-xs mt-1">{actionErrors.comment}</p>}
                </div>
              </div>
            )}

            <div className="bg-[#F8F9FA] border-t border-gray-200 -mx-5 -mb-5 mt-5 py-3 px-5 flex justify-center gap-2 rounded-b">
              <button
                onClick={handleActionSave}
                disabled={submitting}
                className="bg-[#3482AE] hover:bg-[#2c78a6] text-white px-5 py-1.5 rounded text-xs font-bold uppercase tracking-wider min-w-[80px]"
              >
                {submitting ? <span className="loading-spinner h-3 w-3" /> : 'SUBMIT'}
              </button>
              <button
                onClick={() => navigate(-1)}
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