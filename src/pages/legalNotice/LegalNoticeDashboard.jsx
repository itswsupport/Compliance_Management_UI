import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import DataTable from '../../components/ui/DataTable';
import ComplianceCalendar from '../../components/ui/ComplianceCalendar';
import StatusBadge from '../../components/ui/StatusBadge';
import SearchableSelect from '../../components/ui/SearchableSelect';
import DashboardNavCards, {
  clearCardCache, setCachedRows, gridColumnsFor, isCompactRow,
} from '../../components/ui/DashboardNavCards';
import { useAuth } from '../../context/AuthContext';
import AddLegalNotice from './AddLegalNotice';
import LegalNoticeView from './LegalNoticeView';
import { getLegalNoticeList } from '../../services/legalNoticeService';
import { fetchComplianceRows, effectiveStatus } from '../../utils/complianceRows';

/** Marks a calendar entry as a legal notice; see handleCalendarSelect. */
const LEGAL_ID_PREFIX = 'LN-';
import { sectionForUser, NAV_CARDS_BY_SECTION, dashboardTitle } from '../../utils/navCards';

/**
 * What a reader's compliance calendar asks the server for, per dashboard.
 *
 * The same sets those pages pass as calendarStatusArray(s), because this is the
 * same calendar - a reader has one month view, and it must not disagree with
 * itself depending on which screen they opened it from. Several sets where one
 * call cannot answer it: the Plant HR endpoint reads its mstStatus off the
 * status list, so outstanding and overdue are two questions.
 */
const READER_CALENDAR_SETS = {
  'plant-hr':  [[0, 3, 4, 11, 2], [0, 5]],
  'comp-head': [[0, 1, 2, 4, 11]],
  'corp-hr':   [[0, 1, 2, 4, 11]],
};
import { getPeriod, setPeriod as setSharedPeriod } from '../../utils/periodFilter';
import { currentSection, sectionOf } from '../../utils/navSection';
import { recordOpened } from '../../utils/recordOpened';
import {
  rowsForTab, legalStatusInfo, filterLegalByPeriod, legalYearsIn, isApproved,
} from '../../utils/legalNoticeRows';

// Both mirror ComplianceListPage, so the filter bars across the app are the same
// control in the same words.
const MONTHS = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
];

// SearchableSelect, not a native <select>: a native popup is drawn by the OS, so
// its highlighted option is grey and cannot be styled.
const FILTER_TRIGGER_CLS =
  'h-[22px] w-full leading-none bg-white border border-gray-300 hover:border-[#3482AE] ' +
  'transition-colors rounded-sm px-2 flex items-center justify-between gap-1 text-left cursor-pointer';

/**
 * How often the list re-reads itself while the screen is in front of the user.
 *
 * Matches NotificationBell's own interval, which is the other thing in this app
 * that has to hear about somebody else's work without being navigated to.
 */
const REFRESH_MS = 60000;

// The tabs, in the order they are shown. ADD is first because raising a legal
// notice is what a Plant HR comes here to do; the rest report on what is already
// raised. Comp Admin gets the same row with ADD dropped — they approve legal
// notices, they do not raise them.
const TABS = [
  { id: 'add',      label: 'Add Legal Notice', icon: 'fas fa-plus',         color: 'bg-c-info',    header: 'card-header-info' },
  { id: 'pending',  label: 'Pending',          icon: 'fas fa-spinner',      color: 'bg-c-pending', header: 'card-header-pending' },
  { id: 'approved', label: 'Approved',         icon: 'fas fa-check-square', color: 'bg-c-green1',  header: 'card-header-approved' },
  { id: 'overdue',  label: 'Overdue',          icon: 'far fa-hourglass',    color: 'bg-c-draft',   header: 'card-header-overdue' },
  // Comp Admin only. They are the one who rejects, so it is their outbox — and
  // for the Plant HR a rejected notice is simply work back on their desk, which
  // is what Pending already says.
  { id: 'rejected', label: 'Rejected',         icon: 'fas fa-times-circle', color: 'bg-c-reject',  header: 'card-header-rejected' },
];

/**
 * The Legal Notice screen.
 *
 * One route for every role, because it is one set of records — what differs is
 * only what the person in front of it may do:
 *
 *   Plant HR / CHD  raise them, submit them, and see the four tabs
 *   Comp Admin      approve or reject them, and see the same tabs without Add
 *   everyone else   read them, with no tabs and no action history at all
 *
 * The reader case is why this borrows the Notice Dashboard's shape rather than
 * ComplianceListPage's: a reader arrives from the Legal Notice card on their own
 * dashboard, so the card row they see has to be that dashboard's row — the way
 * back — not a row of this screen's own.
 *
 * Every tab is the same fetch read a different way, so the list is loaded once
 * and split here. Three status-filtered requests to draw one screen would be
 * three round trips for rows that are already in the browser.
 */
export default function LegalNoticeDashboard() {
  const { user } = useAuth();
  const { state, pathname, search } = useLocation();
  const navigate = useNavigate();
  // ?open=<id> — the bell's way of naming a notice to open. See NotificationBell.
  const openParam = new URLSearchParams(search).get('open');
  const fromCalendar = new URLSearchParams(search).get('from') === 'calendar';

  /**
   * Which dashboard this visit belongs to — read straight off the URL.
   *
   * "/comp-head/legal-notice" is the Comp Head reading legal notices; it says so
   * itself, and it keeps the user inside the comp-head section while they do.
   * "/legal-notice/list" is the sidebar's workspace and belongs to no dashboard,
   * so it falls back to the one the user was last working in, and only then to
   * their own default for a pasted URL.
   */
  const pathSection = sectionOf(pathname);
  // "/<dashboard>/legal-notice" — a card on somebody's dashboard, so the
  // dashboard is named in the URL. "/legal-notice/list" is the sidebar
  // workspace and belongs to none, so it falls back to where the user was last
  // working, then to their own default.
  const onSectionRoute = pathname.endsWith('/legal-notice');
  const section = onSectionRoute ? pathSection : (currentSection() || sectionForUser(user));

  /**
   * Opened as a reader — read-only, whatever role the user holds.
   *
   * Every "/<dashboard>/legal-notice" route, not just the four whose roles can
   * only ever read. A card on a dashboard shows you something WHILE you stand on
   * that dashboard; it does not carry you off to another one. A Plant HR
   * clicking the Legal Notice card on their own dashboard was being handed the
   * whole workspace — Add form and all — which is a different place, and the
   * heading then had to either lie about the dashboard or lie about the screen.
   *
   * The workspace has its own door: the sidebar entry, /legal-notice/list. That
   * is where a Plant HR raises and a Comp Admin approves.
   */
  const readingAs = onSectionRoute;

  // The Plant HR raises legal notices; the Comp Admin approves them. Those two
  // work here — on the workspace route. Everybody else reads, CHD included.
  //
  // NOT isChd, though the compliance flow pairs CHD with Plant HR everywhere
  // else — homePathForUser sends both to /plant-hr/pending, and a CHD acts on
  // compliances just as a Plant HR does. A legal notice is different: a CHD has
  // view access and nothing more, so they get the sidebar entry but the
  // read-only screen behind it. The server refuses a raise from them either way.
  const canAdd    = !readingAs && Boolean(user?.isPlantHr);
  const isWorker  = !readingAs && Boolean(canAdd || user?.isCompAdmin);
  const readOnly  = !isWorker;

  const isAdmin = !readingAs && Boolean(user?.isCompAdmin);

  const tabs = useMemo(
    () => TABS.filter((t) => {
      if (t.id === 'add') return canAdd;
      if (t.id === 'rejected') return isAdmin;
      return true;
    }),
    [canAdd, isAdmin],
  );

  // A reader borrows the card row of the dashboard they came from — the same
  // trick the Notice Dashboard uses, and for the same reason: this screen
  // belongs to no role, and a user holding two roles would otherwise always get
  // the row of their highest one rather than the one they actually came from.
  const readerCards = NAV_CARDS_BY_SECTION[section] || [];

  const [data, setData]       = useState([]);
  /*
   * One calendar, opened in place. A worker sees their legal notices; a reader
   * sees those AND their compliances, because a reader has no compliance
   * calendar of their own to keep them apart - this is their single month view.
   */
  const [calendarOpen, setCalendarOpen] = useState(() => fromCalendar);

  /** A reader's calendar carries their compliances too; a worker's does not. */
  const calendarSets = readOnly ? READER_CALENDAR_SETS[section] : null;
  const [complianceRows, setComplianceRows] = useState([]);
  const [loading, setLoading] = useState(true);

  /**
   * The compliances that share a reader's calendar.
   *
   * Fetched the way their own dashboard fetches them - same sets, same endpoint,
   * chosen by section - so the two entry points draw the same month. Lazy:
   * nobody pays for it until the calendar is opened.
   */
  useEffect(() => {
    if (!calendarOpen || !user || !calendarSets || complianceRows.length) return;
    let cancelled = false;
    (async () => {
      try {
        const lists = await Promise.all(
          calendarSets.map((set) => fetchComplianceRows(user, set, `/${section}/`)),
        );
        if (cancelled) return;
        const byId = new Map();
        lists.flat().forEach((row) => { if (row && !byId.has(row.id)) byId.set(row.id, row); });
        // Only what still has a deadline, the rule every calendar here follows.
        setComplianceRows([...byId.values()].filter((row) => effectiveStatus(row) !== 1));
      } catch {
        // The notices still draw on their own.
      }
    })();
    return () => { cancelled = true; };
  }, [calendarOpen, user, calendarSets, section, complianceRows.length]);

  const [tab, setTab]         = useState('pending');
  // Non-null id means the detail view has replaced whatever was in the card.
  const [viewId, setViewId]   = useState(openParam ? Number(openParam) : (state?.openId ?? null));

  // The compliance dashboards' filter, not one of this screen's own — so a year
  // picked here is still applied after clicking through to a compliance tab, and
  // one picked there is still applied on arriving here.
  const [period, setPeriodState] = useState(getPeriod());
  const { year, month } = period;

  function setPeriod(next) {
    setPeriodState(setSharedPeriod(next));
  }

  const load = useCallback(async () => {
    if (!user?.empCode) return;
    setLoading(true);
    try {
      // The server decides what this employee may see — see getLegalNoticeList.
      const res = await getLegalNoticeList(user.empCode);
      const rows = res.data?.response || [];
      setData(rows);
      // Publish them for the Legal Notice card on the reader dashboards, so its
      // number and the list behind it can never disagree. Unfiltered: the period
      // is applied where it is read.
      setCachedRows(pathname, rows);
    } catch {
      // Leave the list as it is rather than emptying it over one blip.
    } finally {
      setLoading(false);
    }
  }, [user?.empCode, pathname]);

  useEffect(() => { load(); }, [load]);


  /**
   * Keep the list current without the user navigating.
   *
   * A Plant HR raises a notice in one browser while the Comp Admin is looking at
   * their list in another: nothing about that reaches this screen on its own,
   * and the admin was left staring at a list that was right when it loaded and
   * wrong ever since.
   *
   * Three signals, none of them polling hard:
   *   visibilitychange — the tab was hidden and has come back
   *   focus            — the WINDOW came back. Switching between two open
   *                      browsers does not always hide either tab, so
   *                      visibilitychange alone never fires for exactly the case
   *                      this exists for.
   *   the interval     — for somebody who simply leaves the screen open.
   *
   * Skipped while hidden, so a background tab costs nothing.
   */
  useEffect(() => {
    if (!user?.empCode) return undefined;
    const refresh = () => { if (!document.hidden) load(); };
    const timer = setInterval(refresh, REFRESH_MS);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [user?.empCode, load]);

  // Arriving from the bell names a notice to open.
  //
  // The useState above already covers a fresh mount; this covers the bell being
  // clicked while this screen is ALREADY open, where React Router keeps the
  // component mounted and the initialiser never runs again.
  //
  // Keyed on openId alone, so "back to list" is not undone by it: closing the
  // detail changes viewId, not the state this depends on, and the effect does
  // not fire again.
  useEffect(() => {
    const id = openParam ? Number(openParam) : state?.openId;
    if (id) {
      setViewId(id);
      recordOpened(id, 'LEGAL_NOTICE');
    }
  }, [openParam, state?.openId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Only the years that actually have legal notices, newest first — offering a
  // year with no rows would be offering an empty list.
  const yearOptions = useMemo(() => legalYearsIn(data), [data]);

  // A reader has no tabs, so they see everything; a worker sees the tab they
  // picked. The period narrows whichever it is.
  // Whether a Rejected card is on screen to hold the rejected rows. Read off the
  // tabs themselves rather than re-deriving the role, so the cards and the lists
  // behind them cannot disagree about where a notice belongs.
  const hasRejectedTab = useMemo(() => tabs.some((t) => t.id === 'rejected'), [tabs]);

  const tabRows = useMemo(
    () => (readOnly ? data : rowsForTab(data, tab, hasRejectedTab)),
    [data, tab, readOnly, hasRejectedTab],
  );
  const rows = useMemo(
    () => filterLegalByPeriod(tabRows, year, month),
    [tabRows, year, month],
  );

  // Every card's count, off rows already in the browser — so switching tabs
  // costs nothing and the numbers always agree with the lists behind them.
  const counts = useMemo(() => {
    const out = {};
    tabs.forEach((t) => {
      if (t.id === 'add') return;
      out[t.id] = filterLegalByPeriod(rowsForTab(data, t.id, hasRejectedTab), year, month).length;
    });
    return out;
  }, [data, tabs, year, month, hasRejectedTab]);

  const filtered = year !== '' || month !== '';

  function handleView(id) {
    setViewId(id);
    // The one place a legal notice is opened, so telling the bell here covers
    // every way in — a row in the list, or a click on the bell itself. It clears
    // whatever notification points at this record.
    recordOpened(id, 'LEGAL_NOTICE');
  }

  /**
   * Back out of the detail or the Add form.
   *
   * Only something that actually saved can have moved a record between tabs, so
   * a plain "back" after reading one keeps the list on screen instead of
   * re-running its query.
   */
  function handleClose(changed = false) {
    setViewId(null);
    /*
     * Drop ?open= from the URL on the way out.
     *
     * Without this the query outlives the view it opened, and the URL claims a
     * notice is on screen when the list is. Worse, it makes the bell one-shot:
     * a second notification about the SAME notice navigates to the same
     * ?open=39, the value never changes, and the effect that watches it has
     * nothing to react to — so the click does nothing at all. That is easy to
     * hit, because one notice can raise several notifications.
     */
    if (openParam) navigate(pathname, { replace: true });
    if (tab === 'add') setTab('pending');
    if (!changed) return;
    // Every dashboard's Legal Notice card is now stale: there is one per reader
    // dashboard, each cached under its own path, and this action can have moved
    // the record out of what any of them counts. clearSectionCache takes a
    // single section and would leave the other three showing a stale number.
    clearCardCache();
    load();
  }

  function handleTab(id) {
    setViewId(null);
    // And close the calendar. Picking a card is a request to see THAT list, but
    // the calendar shares the slot the list draws in, so leaving it open would
    // answer the click with the same month view the user was already looking at.
    // ComplianceListPage.handleNavCard does the same for the same reason.
    setCalendarOpen(false);
    setTab(id);
  }

  const activeTab = tabs.find((t) => t.id === tab) || tabs[0];

  const columns = [
    { label: 'SR.NO', filterable: false, width: 70, render: (_, i) => i + 1 },
    {
      key: 'noticeNo',
      label: 'LEGAL NOTICE NO',
      width: 190,
      // The same badge the compliance lists give Compliance Sr. No, and a button
      // for the same reason: unlike a plain notice, a legal notice HAS somewhere
      // to open — its history and, when it is your turn, its action form.
      render: (row) => (
        <button onClick={() => handleView(row.id)} className="badge-srno cursor-pointer">
          <i className="fas fa-eye mr-1" /> {row.noticeNo}
        </button>
      ),
    },
    {
      label: 'PLANT', width: 180,
      render: (row) => (row.plantName ? `${row.plantName} - ${row.plantCode}` : String(row.plantCode ?? '-')),
    },
    { key: 'noticeCategory', label: 'CATEGORY', width: 190 },
    { key: 'noticeSubCategory', label: 'SUBCATEGORY', width: 200 },
    {
      key: 'dueDate', label: 'DUE DATE', width: 140,
      render: (row) => row.dueDate || '-',
    },
    { key: 'empName', label: 'RAISED BY', width: 170 },
    {
      label: 'RAISED ON', width: 150,
      render: (row) => `${row.regDate || '-'} ${row.regTime || ''}`.trim(),
    },
    {
      key: 'status', label: 'STATUS', width: 160,
      render: (row) => {
        const s = legalStatusInfo(row.status);
        return <StatusBadge status={row.status} labelOverride={s.label} variantOverride={s.variant} />;
      },
    },
  ];

  // What the card header says, and what colour it wears.
  /**
   * The card header names the record, not just the tab.
   *
   * Short here, because the heading above already says LEGAL NOTICE DASHBOARD —
   * "Pending Legal Notice List" under it would say it twice. The read-only
   * screen is the other way round: its heading is the user's own dashboard, so
   * the header carries the record name instead ("Legal Notice Details").
   *
   * The EXPORT title stays explicit either way: a spreadsheet lands on somebody's
   * desk with no heading above it.
   */
  const cardTitle = viewId
    ? 'Legal Notice View'
    : tab === 'add'
    ? 'Add Legal Notice'
    : readOnly
    ? 'Legal Notice Details'
    : `${activeTab?.label || 'Legal Notice'} List`;

  /**
   * What the calendar draws: every legal notice this screen can see, plus the
   * user's compliances, on one month.
   *
   * ComplianceCalendar reads getDueDate(row), compActType and compSrNo, so the
   * notices are mapped onto those three rather than teaching the calendar a
   * second record shape. The id is prefixed because it hands back only an id on
   * click and the two flows open different screens.
   */
  const calendarRows = useMemo(() => ([
    // Approved notices are left out for the same reason the compliance sets omit
    // status 1: a calendar warns about a deadline, and a closed record has none.
    ...data.filter((n) => !isApproved(n)).map((n) => ({
      id: `${LEGAL_ID_PREFIX}${n.id}`,
      compSrNo: n.noticeNo,
      compActType: n.noticeCategory,
      firstDueDate: n.dueDate,
      compFrequency: '',
      isLegalNotice: true,
    })),
    ...complianceRows,
  ]), [data, complianceRows]);

  /** A legal notice opens here; a compliance belongs to its own dashboard. */
  function handleCalendarSelect(id) {
    const key = String(id);
    if (key.startsWith(LEGAL_ID_PREFIX)) {
      handleView(Number(key.slice(LEGAL_ID_PREFIX.length)));
      return;
    }
    navigate(`/${section}/pending?open=${key}&from=calendar`);
  }

  const headerCls = readOnly ? 'card-header-legal' : (activeTab?.header || 'card-header-legal');

  return (
    <div className="space-y-3">
      {/* The heading names what this screen IS, which is not the same question
          as which URL reached it.

          Read-only, it is a list — a card ON the user's dashboard, the way the
          compliance tabs are, so it keeps that dashboard's name and does not
          pretend they have gone somewhere new.

          For the Plant HR and the Comp Admin it is the workspace: Add, the tabs,
          the action forms. That IS the Legal Notice Dashboard, and calling it
          PLANT HR DASHBOARD would be naming it after the door rather than the
          room — the screen would claim to be one thing while plainly being
          another. */}
      {/* Title line, with the calendar toggle at its right - the same place
          ComplianceListPage keeps its COMPLIANCE CALENDAR button, so the two
          dashboards put it where the eye already looks for it. */}
      <div className="flex items-center justify-between gap-2 no-print">
        <h1 className="section-title no-print">
          {(readOnly && dashboardTitle(section, user)) || 'LEGAL NOTICE DASHBOARD'}
        </h1>
        {/* One button. A reader's calendar carries their compliances as well,
            which is why the label differs. */}
        {!viewId && tab !== 'add' && (calendarSets || !readOnly) && (
          <button
            type="button"
            onClick={() => setCalendarOpen((open) => !open)}
            className="px-2.5 py-1.5 bg-[#3482AE] hover:bg-[#2A6B91] text-white text-[10px] leading-none uppercase rounded-sm border-0 cursor-pointer transition-colors inline-flex items-center gap-1 shrink-0"
          >
            <i className="fas fa-calendar-alt" />
            {readOnly ? 'Compliance Calendar' : 'Legal Notice Calendar'}
          </button>
        )}
      </div>

      {/* The card row. A worker gets this screen's own tabs; a reader gets the
          row of the dashboard they came from, which is their way back. */}
      {readOnly ? (
        <DashboardNavCards
          cards={readerCards}
          currentCount={loading ? undefined : rows.length}
          period={period}
        />
      ) : (
        <div className={`grid grid-cols-1 ${gridColumnsFor(tabs.length)} ${
          isCompactRow(tabs.length) ? 'gap-3' : 'gap-4'
        } no-print`}>
          {tabs.map((t) => (
            <div
              key={t.id}
              onClick={() => handleTab(t.id)}
              className={`stat-card ${isCompactRow(tabs.length) ? 'stat-card-sm' : ''} ${t.color} ${
                t.id === tab && !viewId ? 'ring-2 ring-white/70' : ''
              }`}
            >
              {/* Add keeps its icon — there is no list behind it to count.
                  Every other card shows its number, and never an icon first,
                  which would flash and swap. "..." while loading: a 0 would
                  read as a real answer. */}
              {t.id === 'add'
                ? <i className={`${t.icon} icon`} />
                : (
                  <span className="text-white text-[20px] font-bold leading-none">
                    {loading ? '...' : counts[t.id]}
                  </span>
                )}
              <h5>{t.label}</h5>
            </div>
          ))}
        </div>
      )}

      {/* Period filter — hidden while the Add form or a detail is open, since
          neither has anything to narrow. It reads the DUE date, which is the
          date a legal notice is measured by. */}
      {!viewId && tab !== 'add' && (
        <div className="card no-print px-3 py-1.5 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">
            <i className="fas fa-filter mr-1.5 text-[#3482AE]" />
            Filter By Period
          </span>
          <div className="flex items-center gap-2">
            {filtered && (
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                {rows.length} of {tabRows.length}
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
      )}

      {/* The calendar brings its own card and its own header, so it takes the
          slot rather than sitting inside this one - nesting it left the month
          view under a list card's title. Same shape as ComplianceListPage. */}
      {calendarOpen && !viewId ? (
        <ComplianceCalendar
          data={calendarRows}
          loading={loading}
          onSelect={handleCalendarSelect}
          focusYear={year}
          focusMonth={month}
        />
      ) : (
      <div className="card">
        <div className={`${headerCls} no-print flex items-center justify-between gap-3`}>
          <h3 className="truncate">
            <i className={viewId || tab !== 'add' ? 'fas fa-gavel' : 'fas fa-plus'} /> {cardTitle}
          </h3>
          {viewId && (
            /* calendarOpen is left standing while a notice is open - the detail
               card outranks the calendar rather than replacing it - so closing
               returns to whichever view the notice was picked off, and the
               button says which. Same as Compliance View. */
            <button onClick={() => handleClose()} className="back-to-list-btn">
              <i className="fas fa-chevron-left" />
              {calendarOpen ? ' BACK TO CALENDAR' : ' BACK TO LIST'}
            </button>
          )}
        </div>
        <div className={tab === 'add' && !viewId ? '' : 'p-4 md:p-5'}>
          {viewId ? (
            <LegalNoticeView
              key={viewId}
              id={viewId}
              readOnly={readOnly}
              onBack={handleClose}
            />
          ) : tab === 'add' ? (
            <AddLegalNotice onSaved={() => handleClose(true)} onCancel={() => handleClose()} />
          ) : (
            <DataTable
              columns={columns}
              data={rows}
              loading={loading}
              reportTitle={readOnly
                ? 'Legal Notice List'
                : `${activeTab?.label || ''} Legal Notice List`.trim()}
            />
          )}
        </div>
      </div>
      )}
    </div>
  );
}
