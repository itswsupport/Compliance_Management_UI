import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useShowBackButton } from '../../hooks/useShowBackButton';
import DataTable from '../ui/DataTable';
import StatusBadge from '../ui/StatusBadge';
import { 
  getComplianceList, 
  getPhrComplianceList, 
  getUserComplianceList, 
  getAuthorityComplianceList, 
  deleteCompliance 
} from '../../services/complianceService';
import { useAuth } from '../../context/AuthContext';
import { getDueDate } from '../../utils/formatters';
import { LS_KEYS, STATUS } from '../../utils/constants';

// Thin stroke-based hourglass for the Overdue card (FontAwesome can't render a
// thinner weight in the free set). Adjust strokeWidth to taste.
function HourglassIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="30"
      height="30"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ marginBottom: 1 }}
    >
      <path d="M5 22h14" />
      <path d="M5 2h14" />
      <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
      <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
    </svg>
  );
}

// Stroke-based plus for the Assign Compliance card.
function PlusIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="30"
      height="30"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="4.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ marginBottom: '1px' }}
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

// Master-status labels for the Status column — notably status 4 = "Re-Submitted"
// (NOT "Approval Pending" from the global STATUS_LABELS).
// Used when the current user has no waiting row (i.e. show the record's real status).
const LIST_STATUS = {
  0:  { label: 'Submission Pending',     variant: 'warning' },
  1:  { label: 'Approved',               variant: 'success' },
  2:  { label: 'Rejected',               variant: 'danger'  },
  3:  { label: 'Submitted',              variant: 'info'    },
  4:  { label: 'Re-Submitted',           variant: 'info'    },
  5:  { label: 'Pending',                variant: 'warning' },
  6:  { label: 'Compliance Assigned',    variant: 'primary' },
  11: { label: 'Approval Pending',       variant: 'warning' },
  22: { label: 'Final Approval Pending', variant: 'warning' },
};

/**
 * Reusable compliance list page.
 * Props:
 *   title          — page title
 *   headerColor    — Tailwind card-header class
 *   statusArray    — status codes to fetch
 *   navCards       — array of { label, icon, color, to }
 *   showDelete     — show delete button (Comp Admin pending)
 *   viewPath       — path to navigate to view detail, e.g. '/comp-admin/view'
 *   storageKey     — localStorage key name for selected id (default 'id')
 */
export default function ComplianceListPage({
  title,
  listTitle = 'Compliance',
  headerColor = 'card-header-primary',
  statusArray = [],
  navCards = [],
  showDelete = false,
  viewPath = '',
  storageKey = LS_KEYS.ID,
}) {
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const showBack = useShowBackButton();

  const { user } = useAuth();

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const path = window.location.pathname;
      let res;
      if (path.includes('/comp-admin/')) {
        res = await getComplianceList(user.empCode, statusArray);
      } else if (path.includes('/plant-hr/')) {
        let mstStatus = 0;
        if (statusArray.includes(5)) {
          mstStatus = 5;
        } else if (statusArray.includes(1)) {
          mstStatus = 1;
        } else {
          mstStatus = 0;
        }
        res = await getPhrComplianceList(mstStatus, user.empCode, user.level, statusArray);
      } else if (path.includes('/authority/')) {
        res = await getAuthorityComplianceList(statusArray);
      } else {
        // comp-head, corp-hr, hcm-head
        // Corp HR should see requests from all assigned plants (backend handles plant filtering)
        // Don't pass plantCode - let backend filter based on Corp HR's plant assignments
        res = await getUserComplianceList(user.empCode, user.level, statusArray);
      }
      setData(res.data?.response || []);
    } finally {
      setLoading(false);
    }
  }, [statusArray, user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  function handleView(id) {
    localStorage.setItem(storageKey, id);
    navigate(viewPath);
  }

  async function handleDelete(id) {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: 'You want to delete this Compliance!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, Delete it!',
    });
    if (!result.isConfirmed) return;
    try {
      const res = await deleteCompliance(id);
      const obj = res.data;
      if (obj.status_code === 200) {
        Swal.fire({ title: obj.message, icon: 'success', timer: 1500, showConfirmButton: false });
        load();
      } else {
        Swal.fire({ title: obj.message, icon: 'warning', timer: 3000, showConfirmButton: false });
      }
    } catch {
      Swal.fire({ title: 'Something went wrong!', icon: 'error' });
    }
  }

  // Role + tab decide the extra middle columns (between Due Date and Status):
  //   Comp Admin  -> Department + person (Pending At / Approved By); Action on pending
  //   Authority   -> person only (Action Pending / Approved By / Rejected By)
  //   Plant HR / Comp Head / Corp HR / HCM Head -> none (base columns only)
  const path = window.location.pathname;
  const tab =
    path.includes('/pending')  ? 'pending'  :
    path.includes('/approved') ? 'approved' :
    path.includes('/overdue')  ? 'overdue'  :
    path.includes('/rejected') ? 'rejected' : '';
  const isCompAdminDash = path.includes('/comp-admin/');
  const isAuthorityDash = path.includes('/authority/');

  const rows = tab === 'pending'
    ? data.filter((row) => {
        const iAmStillWaiting = (row.compActionList || []).some(
          (a) => Number(a.authEmpCode) === Number(user?.empCode) &&
            [0, 5, 11, 22].includes(Number(a.status)),
        );
        return iAmStillWaiting || Number(row.status) !== STATUS.APPROVED;
      })
    : data;

  const showDeptCol = isCompAdminDash;
  // Comp Admin hides the person column ("Approved By") on its Approved tab;
  // all other Comp Admin tabs and the Authority dashboard keep it.
  const showPersonCol = isCompAdminDash
    ? tab !== 'approved'
    : isAuthorityDash;
  const personLabel =
    tab === 'approved' ? 'Approved By' :
    tab === 'rejected' ? 'Rejected By' :
    isAuthorityDash ? 'Action Pending' : 'Pending At'; // pending / overdue

  const columns = [
    {
      key: 'compSrNo',
      label: 'Compliance Sr. No',
      render: (row) => (
        <button
          onClick={() => handleView(row.id)}
          className="badge-srno cursor-pointer"
        >
          <i className="fas fa-eye mr-1" /> {row.compSrNo}
        </button>
      ),
    },
    { key: 'plantCode', label: 'Plant Code' },
    { key: 'compActType', label: 'Compliance Act' },
    { key: 'compActSubType', label: 'Compliance Act Sub Type' },
    { key: 'compApplicableYear', label: 'Applicable Year' },
    { key: 'compFrequency', label: 'Frequency' },
    {
      key: 'dueDate',
      label: 'Due Date',
      render: (row) => getDueDate(row),
    },
    ...(showDeptCol
      ? [{
          key: 'deptDetails',
          label: 'Department',
          render: (row) => row.deptDetails?.deptName || '-',
        }]
      : []),
    ...(showPersonCol
      ? [{ key: 'actionByEmpName', label: personLabel }]
      : []),
    {
      key: 'status',
      label: 'Status',
      render: (row) => {
        const myPending = (row.compActionList || [])
          .filter((a) => Number(a.authEmpCode) === Number(user?.empCode) &&
            [0, 5, 11, 22].includes(Number(a.status)))
          .pop();
        if (myPending) {
          const lvl = Number(myPending.authLevel);
          // authLevel 1/4 = doer submit; 2 = Comp Head/Corp HR approval;
          // 3 = HCM Head final approval.
          const label =
            (lvl === 1 || lvl === 4) ? 'Submission Pending' :
            lvl === 3 ? 'Final Approval Pending' :
            'Pending';
          return <StatusBadge status={row.status} labelOverride={label} variantOverride="warning" />;
        }
        // No waiting row for me → show the record's ACTUAL status
        // (e.g. status 4 → "Re-Submitted", not "Approval Pending").
        const s = LIST_STATUS[Number(row.status)];
        return s
          ? <StatusBadge status={row.status} labelOverride={s.label} variantOverride={s.variant} />
          : <StatusBadge status={row.status} />;
      },
    },
    ...(showDelete
      ? [{
          label: 'Action',
          filterable: false,
          render: (row) => (
            <button
              onClick={() => handleDelete(row.id)}
              className="btn-danger btn-sm btn"
              title="Delete"
            >
              <i className="fas fa-trash" />
            </button>
          ),
        }]
      : []),
  ];

  return (
    <div className="space-y-3">
      {/* Page header with Back button */}
      <div className="flex items-center justify-between no-print">
        <h1 className="section-title">
          {title}
        </h1>
        {showBack && (
          <button onClick={() => navigate(-1)} className="back-button">
            <i className="fas fa-chevron-left" /> Back
          </button>
        )}
      </div>
      <h1 className="section-title print-only hidden">
        {listTitle} List
      </h1>

      {/* Navigation stat cards */}
      {navCards.length > 0 && (
        <div className={`grid grid-cols-1 md:grid-cols-${navCards.length === 3 ? '3' : '4'} gap-4 no-print`}>
          {navCards.map((card) => (
            <div
              key={card.label}
              onClick={() => navigate(card.to)}
              className={`stat-card ${card.color}`}
            >
              {card.icon === 'fas fa-check-square'
                ? <i className="far fa-check-square" style={{ fontSize: '2.3em', marginBottom: '1px', color: 'white' }} />
                : card.icon.includes('fa-hourglass')
                ? <HourglassIcon />
                : card.icon.includes('fa-plus')
                ? <PlusIcon />
                : (card.icon.includes('fa-times-circle') || card.icon.includes('fa-window-close'))
                ? <i className="far fa-window-close fa-2x" style={{ fontSize: '2.2em' ,marginBottom: '1px', color: 'white' }} />
                : card.icon.includes('fa-spinner')
                ? <i className={`${card.icon} icon`} style={{ marginBottom: 1 }} />
                : <i className={`${card.icon} icon`} />}
              <h5>{card.label}</h5>
            </div>
          ))}
        </div>
      )}

      {/* Table card */}
      <div className="card">
        <div className={`${headerColor} no-print`}>
          <h3>
            <i className="fas fa-tasks" /> {listTitle} List
          </h3>
        </div>
        <div className="p-4 md:p-5">
          <DataTable columns={columns} data={rows} loading={loading} reportTitle={`${listTitle} List`} />
        </div>
      </div>
    </div>
  );
}
