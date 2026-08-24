import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import Swal from 'sweetalert2';
import DataTable from '../../components/ui/DataTable';
import SearchableSelect from '../../components/ui/SearchableSelect';
import DashboardNavCards, { clearSectionCache } from '../../components/ui/DashboardNavCards';
import { useAuth } from '../../context/AuthContext';
import { getNoticeList, getNoticeDownloadUrl, deleteNotice } from '../../services/noticeService';
import { extractFilename } from '../../utils/formatters';
import { filterNoticesByPeriod, noticeYearsIn } from '../../utils/noticeRows';
import { sectionForUser, NAV_CARDS_BY_SECTION } from '../../utils/navCards';
import { markNoticeNotificationsRead } from '../../services/notificationService';
import { noticesRead } from '../../utils/noticeRead';
import { getPeriod, setPeriod as setSharedPeriod } from '../../utils/periodFilter';

// Both mirror ComplianceListPage, so the two filter bars are the same control
// in the same words — a user who has filtered a compliance list has already
// learnt this one. Kept local the way ComplianceCalendar keeps its own MONTHS.
const MONTHS = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
];

// SearchableSelect, not a native <select>: a native popup is drawn by the OS,
// so its highlighted option is grey and cannot be styled.
const FILTER_TRIGGER_CLS =
  'h-[22px] w-full leading-none bg-white border border-gray-300 hover:border-[#3482AE] ' +
  'transition-colors rounded-sm px-2 flex items-center justify-between gap-1 text-left cursor-pointer';

/** The list out of a BaseResponseBO, or an empty one. */
function rowsOf(res) {
  return res?.data?.response || [];
}

/**
 * The Notice Dashboard.
 *
 * A notice carries no approval flow: the Compliance Admin publishes it from
 * Assign Compliance and it simply appears here for the Plant HR and Group HR it
 * was addressed to. Nothing on this screen acts on a notice — it is the notices
 * themselves and the document each one carries, and that is all.
 *
 * Hence no stat cards and no view switcher: there is only one thing to show, so
 * there is nothing for a card to choose between.
 */
export default function NoticeDashboard() {
  const { user } = useAuth();
  const { state } = useLocation();

  // The dashboard this page is standing in for: the one whose NOTICE card
  // opened it, and only failing that the user's own. Set by the card — see
  // DashboardNavCards — so it is absent when the page is reached by URL.
  const section = state?.fromSection || sectionForUser(user);

  // Withdrawing belongs to the Comp Admin dashboard, not merely to somebody who
  // holds the role. A user who is both Comp Admin and Comp Head reads notices
  // as a Comp Head when that is the dashboard they came from, and reading is
  // all that dashboard does — so no action column there.
  //
  // The role is still required: fromSection rides on history state, and no
  // amount of it should hand the button to someone who is not an admin.
  const canAct = !!user?.isCompAdmin && section === 'comp-admin';

  // The card row of that same dashboard, so the way back leads where the user
  // came from rather than to whichever role happens to rank highest.
  const cards = NAV_CARDS_BY_SECTION[section] || [];

  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(true);

  // The compliance dashboards' filter, not one of this page's own: seeded from
  // whatever is already selected and written straight back, so a year picked
  // here is still applied after clicking through to a compliance tab, and one
  // picked there is still applied on arriving here. '' means "all" on either
  // side, so a month alone spans every year.
  const [period, setPeriodState] = useState(getPeriod());
  const { year, month }          = period;

  function setPeriod(next) {
    setPeriodState(setSharedPeriod(next));
  }

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // The server decides what this employee may see — see getNoticeList.
      setData(rowsOf(await getNoticeList(user.empCode)));
      // Every notice is on this page, so arriving here has read all of them.
      // One call clears the lot from the bell; a failure only means the badge
      // lingers until the next visit, which is not worth losing the list over.
      markNoticeNotificationsRead(user.empCode)
        // The bell is already mounted and would not hear about this until its
        // next read, a minute away — so tell it.
        .then(() => noticesRead())
        .catch(() => {});
    } catch {
      // Leave the list as it is rather than emptying it.
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // Only the years that actually have notices, newest first — offering a year
  // with no rows would be offering an empty list.
  const yearOptions = useMemo(() => noticeYearsIn(data), [data]);

  // The same filter the Notice Dashboard card counts through, so the number on
  // the card and this list can never disagree.
  const rows = useMemo(
    () => filterNoticesByPeriod(data, year, month),
    [data, year, month],
  );

  const filtered = year !== '' || month !== '';

  async function handleDelete(row) {
    const result = await Swal.fire({
      title: 'Withdraw this notice?',
      text: 'It will no longer be visible to any user.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, Withdraw',
    });
    if (!result.isConfirmed) return;
    try {
      const res = await deleteNotice(row.id);
      const obj = res.data;
      Swal.fire({
        title: obj.message,
        icon: obj.status_code === 200 ? 'success' : 'warning',
        timer: obj.status_code === 200 ? 1500 : 3000,
        showConfirmButton: false,
      });
      if (obj.status_code === 200) {
        // Only the notice rows — withdrawing one changes no compliance count.
        clearSectionCache('notice');
        load();
      }
    } catch (err) {
      Swal.fire({
        title: err?.response?.data?.message || 'Could not withdraw the notice',
        icon: 'error',
        confirmButtonColor: '#42ba96',
      });
    }
  }

  const columns = [
    { label: 'SR.NO', filterable: false, width: 70, render: (_, i) => i + 1 },
    {
      key: 'noticeNo',
      label: 'NOTICE NO',
      width: 150,
      // The same badge the compliance lists give Compliance Sr. No. Not a
      // button and no eye icon: a notice has nothing to open — everything it
      // holds is in this row, and the document is the attachment.
      render: (row) => <span className="badge-srno">{row.noticeNo}</span>,
    },
    { key: 'noticeSubject', label: 'SUBJECT', width: 220 },
    // Carried here because there is no detail view; it was the only place the
    // description could be read.
    { key: 'noticeDesc', label: 'DESCRIPTION', width: 260 },
    {
      label: 'PLANT', width: 180,
      // plantCount is how many plants the notice went to. More than one means it
      // was published to every plant — the server sends one line per notice, not
      // one per plant row, so the plant on that line is only one of them.
      render: (row) => (row.plantCount > 1
        ? 'ALL PLANTS'
        : (row.plantName ? `${row.plantName} - ${row.plantCode}` : String(row.plantCode ?? '-'))),
    },
    // The values come from the compliance act masters, but on this dashboard
    // they name a notice, so that is what the columns are called.
    { key: 'noticeCategory', label: 'NOTICE CATEGORY', width: 200 },
    { key: 'noticeSubCategory', label: 'NOTICE SUBCATEGORY', width: 220 },
    { key: 'empName', label: 'PUBLISHED BY', width: 170 },
    {
      label: 'PUBLISHED ON', width: 150,
      render: (row) => `${row.regDate || '-'} ${row.regTime || ''}`.trim(),
    },
    {
      label: 'ATTACHMENT', filterable: false, width: 120,
      // Two icons, one file: open it in a tab, or save it. Reading the document
      // is not an action on the notice — it is the notice. No target on the
      // download: the server answers it with an attachment disposition, and a
      // new tab would open only to close itself again.
      render: (row) => (row.noticeAttachment ? (
        <div className="flex items-center justify-center gap-3 w-full h-full">
          <a
            href={getNoticeDownloadUrl(row.id)}
            target="_blank"
            rel="noreferrer"
            className="text-[#3482AE] hover:opacity-70"
            title={`View ${extractFilename(row.noticeAttachment)}`}
          >
            <i className="fas fa-eye" />
          </a>
          <a
            href={getNoticeDownloadUrl(row.id, true)}
            // The attribute, not just the query param: VITE_API_BASE_URL is a
            // relative path, so the file is same-origin and the browser saves it
            // on its own. Without this the save depends entirely on the server's
            // Content-Disposition, and an image simply opened in the tab.
            download={extractFilename(row.noticeAttachment)}
            className="text-[#42ba96] hover:opacity-70"
            title={`Download ${extractFilename(row.noticeAttachment)}`}
          >
            <i className="fas fa-download" />
          </a>
        </div>
      ) : '-'),
    },
  ];

  // Pushed rather than written into the list above, so every other role gets a
  // table with no ACTION column at all.
  if (canAct) {
    columns.push({
      label: 'ACTION', filterable: false, width: 100,
      render: (row) => (
        <div className="flex items-center justify-center gap-4 w-full h-full">
          <button
            onClick={() => handleDelete(row)}
            className="btn-danger btn-sm btn"
            style={{ padding: '4px 8px' }}
            title="Withdraw Notice"
          >
            <i className="fas fa-trash" />
          </button>
        </div>
      ),
    });
  }

  return (
    <div className="space-y-3">
      <h1 className="section-title no-print">NOTICE DASHBOARD</h1>

      {/* The same card row every other dashboard opens with — this page belongs
          to no single role, so it borrows the row of whichever dashboard this
          user lands on. It is the way back to the compliance tabs now that the
          sidebar has no notice link, and the Notice Dashboard card among them
          is the one the user is standing on.

          currentCount is the filtered count, not data.length: the card for the
          page you are on is answered by the page, and it has to agree with the
          list underneath it. */}
      <DashboardNavCards
        cards={cards}
        currentCount={loading ? undefined : rows.length}
        period={period}
      />

      {/* Period filter, the same bar the compliance dashboards carry — here it
          narrows by the day the notice was published, which is the only date a
          notice has. */}
      <div className="card no-print px-3 py-1.5 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">
          <i className="fas fa-filter mr-1.5 text-[#3482AE]" />
          Filter By Period
        </span>
        <div className="flex items-center gap-2">
          {filtered && (
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
              {rows.length} of {data.length}
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

      <div className="card">
        {/* The same purple the NOTICE card wears, so the card and the screen it
            opens are one thing. Not a status colour: green would read as
            Approved, orange as Pending, and a notice is neither. */}
        <div className="card-header-notice flex items-center justify-between gap-3 select-none no-print">
          <h3 className="truncate">
            <i className="fas fa-bullhorn" /> Notice Details
          </h3>
        </div>
        <div className="p-4 md:p-5">
          <DataTable
            columns={columns}
            data={rows}
            loading={loading}
            reportTitle="Notice List"
          />
        </div>
      </div>
    </div>
  );
}
