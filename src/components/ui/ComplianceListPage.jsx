import { useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import Swal from 'sweetalert2';
import DataTable from '../ui/DataTable';
import StatusBadge from '../ui/StatusBadge';
import ComplianceCalendar from '../ui/ComplianceCalendar';
import SearchableSelect from '../ui/SearchableSelect';
import DashboardNavCards, { clearCardCache, clearSectionCache, setCachedRows, cachedEntries } from '../ui/DashboardNavCards';
import ComplianceView from '../../pages/compAdmin/ComplianceView';
import { deleteCompliance } from '../../services/complianceService';
import { useAuth } from '../../context/AuthContext';
import { getDueDate } from '../../utils/formatters';
import { LS_KEYS } from '../../utils/constants';
import { COUNT_STATUS_BY_PATH } from '../../utils/dashboardCounts';
import { fetchComplianceRows, visibleRows, filterByPeriod, yearsIn } from '../../utils/complianceRows';
import { enteredSection, sectionOf } from '../../utils/navSection';
import { recordOpened } from '../../utils/recordOpened';
import { getPeriod, setPeriod as setSharedPeriod, resetPeriod } from '../../utils/periodFilter';

const MONTHS = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
];

// The filter dropdowns are SearchableSelect, not a native <select>: a native
// popup is drawn by the OS, so its highlighted option is grey and cannot be
// styled. This is the same control the forms use, whose options highlight blue.
const FILTER_TRIGGER_CLS =
  'h-[22px] w-full leading-none bg-white border border-gray-300 hover:border-[#3482AE] ' +
  'transition-colors rounded-sm px-2 flex items-center justify-between gap-1 text-left cursor-pointer';

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

// Who the shared period belongs to — "<empCode>|<dashboard>". Logout does not reload
// the page, so without this the next user inherits the filter and card counts.
let periodOwner = null;
// Who the row cache belongs to — empCode only. Rows are deliberately KEPT when
// a multi-role user moves between dashboards: the navbar bell reads them, and
// dropping them meant an admin sitting on another dashboard was never told his
// compliance had been approved.
let cacheOwner = null;

export default function ComplianceListPage({
  title,
  listTitle = 'Compliance',
  headerColor = 'card-header-primary',
  statusArray = [],
  navCards = [],
  showDelete = false,
  showCalendar = false,
  calendarDefaultOpen = false,
  viewShowAction = true,
  storageKey = LS_KEYS.ID,
}) {
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(true);
  // Compliance detail opens inside this card instead of on its own route —
  // non-null id means the view has replaced the list.
  const [viewId, setViewId]   = useState(null);
  // Calendar and list share the same slot — opening one hides the other.
  const [calendarOpen, setCalendarOpen] = useState(false);
  // Due-date filter. '' means "all"; a month on its own spans every year.
  // One selection drives the table, the calendar AND every card's count, and
  // it survives a move to another tab, and the Notice Dashboard — see
  // utils/periodFilter.
  const [period, setPeriodState] = useState(getPeriod());
  const { year, month } = period;

  function setPeriod(next) {
    setPeriodState(setSharedPeriod(next));
  }
  // Router pathname, not window.location — the latter carries the "/compliance"
  // basename, which the nav card `to` values do not.
  const { pathname } = useLocation();

  const { user } = useAuth();

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      setData(await fetchComplianceRows(user, statusArray));
    } catch {
      // Leave the table as it is rather than emptying it.
    } finally {
      setLoading(false);
    }
  }, [statusArray, user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // The tab we are on republishes its own rows — free, and it means the count
  // another page shows for this tab is as fresh as the last time the user
  // actually looked at it. Unfiltered: the filter is applied where it is read,
  // so changing it never needs another fetch.
  useEffect(() => {
    if (loading || !user || !COUNT_STATUS_BY_PATH[pathname]) return;
    setCachedRows(pathname, visibleRows(data, pathname.includes('/pending'), user.empCode));
  }, [data, loading, pathname, user]);

  // Where the user came from. Runs before paint; enteredSection mutates the
  // recorded section, so it must be called once per navigation — hence one effect.
  useLayoutEffect(() => {
    const arrived = enteredSection(pathname);
    const owner = `${user?.empCode ?? ''}|${sectionOf(pathname)}`;
    const ownerChanged = owner !== periodOwner;
    periodOwner = owner;

    // Filter spans one dashboard's tabs only — and the Notice Dashboard, which
    // records no section of its own, so a trip to the notices and back is not
    // "arriving somewhere new" and does not clear what the user selected.
    if (arrived || ownerChanged) {
      setPeriodState(resetPeriod());
    }

    // Only a change of USER empties the cache. A change of dashboard keeps it,
    // so the bell can still see the other dashboard's rows.
    const me = String(user?.empCode ?? '');
    if (me !== cacheOwner) {
      cacheOwner = me;
      clearCardCache();
    } else if (arrived) {
      // Arriving here re-reads THIS dashboard: the cache is fetch-once, so rows
      // taken before someone else acted would otherwise never be refreshed.
      clearSectionCache(sectionOf(pathname));
    }

    // Arriving from elsewhere leads with the calendar; own tabs show the list.
    if (showCalendar && calendarDefaultOpen && arrived) {
      setCalendarOpen(true);
    }
  }, [pathname, showCalendar, calendarDefaultOpen, user]);

  // calendarOpen is deliberately left alone: the detail card outranks it while
  // viewId is set, so closing the detail drops the user back wherever they came
  // from — the calendar if that is what they picked the compliance off.
  function handleView(id) {
    localStorage.setItem(storageKey, id);
    setViewId(id);
    // The one entry point for opening a record here — the eye on a row and a
    // pick off the calendar both land in it — so telling the bell here covers
    // both. It clears any notification pointing at this record.
    recordOpened(id);
  }

  // Back out of the detail. Only an action that actually saved something can
  // have moved a record between tabs, so a plain "back" after reading a record
  // keeps the list on screen instead of re-running its query.
  function handleCloseView(changed = false) {
    setViewId(null);
    if (!changed) return;
    clearCardCache();
    load();
  }

  // A nav card pointing at the page we are already on cannot navigate anywhere —
  // React Router keeps the component mounted, so the calendar (or an open
  // compliance) would just stay put. Treat that click as "show me the list",
  // which is how the card reads when the calendar is what's on screen.
  function handleNavCard() {
    setCalendarOpen(false);
    setViewId(null);
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
        // A deleted record can drop out of any tab's count, so the cached
        // numbers are no longer trustworthy — let them be counted again.
        clearCardCache();
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

  // Card header reads "<tab> List" normally, "Compliance View" while a record is open.
  const cardTitle = viewId ? 'Compliance View' : `${listTitle} List`;

  // Everything downstream — table, calendar and this page's own card count —
  // reads `rows`, so the filter is applied once, here.
  const allRows = visibleRows(data, tab === 'pending', user?.empCode);
  // Newest first (highest id). Copied before sorting — sort() mutates in place.
  const rows = [...filterByPeriod(allRows, year, month)]
    .sort((a, b) => Number(b.id) - Number(a.id));

  // Every tab of THIS dashboard, so a year that only exists on another card here
  // is still selectable. Scoped by section: the cache now also holds the other
  // dashboards' rows, and offering their years would list years with no rows.
  const hereRows = cachedEntries()
    .filter(([p]) => sectionOf(p) === sectionOf(pathname))
    .flatMap(([, list]) => list || []);
  const yearOptions = yearsIn([...allRows, ...hereRows]);

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

  const filtered = year !== '' || month !== '';

  // Period filter, in its own bar under the cards. It is labelled "Filter By
  // Period" rather than "Due Date" because one selection narrows every tab —
  // Pending, Approved, Rejected and Overdue alike — not just the due-date
  // column: every card's count, the list below, and the calendar that takes
  // the same slot. Rows whose due date cannot be read drop out while a filter
  // is on, since they cannot be shown to satisfy the period.
  const filterBar = (
    <div className="card no-print px-3 py-1.5 flex flex-wrap items-center justify-between gap-2">
      <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">
        <i className="fas fa-filter mr-1.5 text-[#3482AE]" />
        Filter By Period
      </span>
      <div className="flex items-center gap-2">
        {filtered && (
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
            {rows.length} of {allRows.length}
          </span>
        )}
        <SearchableSelect
          value={year}
          onChange={(y) => setPeriod({ ...period, year: y })}
          options={[
            { value: '', label: 'ALL YEARS' },
            ...yearOptions.map((y) => ({ value: String(y), label: String(y) })),
          ]}
          searchable={false}
          className="w-[110px]"
          buttonClassName={FILTER_TRIGGER_CLS}
          optionClassName="text-gray-700"
        />
        <SearchableSelect
          value={month}
          onChange={(m) => setPeriod({ ...period, month: m })}
          options={[
            { value: '', label: 'ALL MONTHS' },
            ...MONTHS.map((m, i) => ({ value: String(i), label: m })),
          ]}
          searchable={false}
          className="w-[124px]"
          buttonClassName={FILTER_TRIGGER_CLS}
          optionClassName="text-gray-700"
        />
        {filtered && (
          <button
            type="button"
            onClick={() => setPeriod({ year: '', month: '' })}
            title="Clear filter"
            className="w-[22px] h-[22px] flex items-center justify-center rounded-sm text-gray-500 hover:text-white hover:bg-[#3482AE] transition-colors cursor-pointer"
          >
            <i className="fas fa-times text-[12px]" />
          </button>
        )}
      </div>
    </div>
  );

  // Table card — swapped for the Compliance View while a record is open.
  const listCard = (
    <div className="card">
      <div className={`${headerColor} no-print flex items-center justify-between gap-3`}>
        <h3 className="truncate">
          <i className="fas fa-tasks" /> {cardTitle}
        </h3>
        {viewId && (
          <button onClick={() => handleCloseView()} className="back-to-list-btn">
            <i className="fas fa-chevron-left" />
            {calendarOpen ? 'BACK TO CALENDAR' : 'BACK TO LIST'}
          </button>
        )}
      </div>
      <div className="p-4 md:p-5">
        {viewId ? (
          <ComplianceView
            key={viewId}
            embedded
            showAction={viewShowAction}
            onBack={handleCloseView}
          />
        ) : (
          <DataTable columns={columns} data={rows} loading={loading} reportTitle={`${listTitle} List`} />
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Page header — no Back button; returning to the list is done from the
          "Back to List" button on the Compliance View card header below. */}
      <div className="flex items-center justify-between no-print">
        <h1 className="section-title">
          {title}
        </h1>
        {showCalendar && !viewId && (
          <button
            type="button"
            onClick={() => setCalendarOpen((open) => !open)}
            className="px-2.5 py-1.5 bg-[#3482AE] hover:bg-[#2A6B91] text-white text-[10px] leading-none uppercase rounded-sm border-0 cursor-pointer transition-colors inline-flex items-center gap-1 shrink-0"
          >
            <i className="fas fa-calendar-alt" />
            Compliance Calendar
          </button>
        )}
      </div>
      <h1 className="section-title print-only hidden">
        {cardTitle}
      </h1>

      {/* Navigation stat cards. The due-date filter reaches these too, so one
          selection narrows the whole dashboard: this page's own card is counted
          off its filtered rows, and the component filters the rest. */}
      <DashboardNavCards
        cards={navCards}
        currentCount={loading ? undefined : rows.length}
        ready={!loading}
        period={{ year, month }}
        onSameRoute={handleNavCard}
      />

      {/* Filter bar — hidden while a compliance detail is open, since it has
          nothing to narrow there. */}
      {!viewId && filterBar}


      {/* Calendar REPLACES the list card — the header button toggles between
          the two. Opening a compliance closes the calendar so the detail card
          takes the slot, and "Back to List" then lands on the list. */}
      {showCalendar && calendarOpen && !viewId ? (
        <ComplianceCalendar
          data={rows}
          loading={loading}
          onSelect={handleView}
          focusYear={year}
          focusMonth={month}
        />
      ) : (
        listCard
      )}
    </div>
  );
}
