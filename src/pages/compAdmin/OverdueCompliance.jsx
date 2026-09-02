import ComplianceListPage from '../../components/ui/ComplianceListPage';
import { NAV_CARDS_BY_SECTION } from '../../utils/navCards';

const NAV_CARDS = NAV_CARDS_BY_SECTION['comp-admin'];

export default function CompAdminOverdue() {
  return (
    <ComplianceListPage
      title="COMPLIANCE ADMIN DASHBOARD"
      listTitle="Overdue Compliance"
      headerColor="card-header-overdue"
      statusArray={[5]}
      /* The LIST stays status 5 — overdue, and nothing else.
         The CALENDAR gets everything still outstanding, so a compliance can be
         seen approaching its due date rather than only after it has slipped:
         0 pending, 3 submitted, 4 re-submitted, 11 approval pending, 2 rejected,
         5 overdue. Approved (1) is absent on purpose — it is finished, and a
         finished compliance has no deadline left to warn about. */
      calendarStatusArray={[0, 3, 4, 11, 2, 5]}
      navCards={NAV_CARDS}
      showCalendar={true}
      calendarDefaultOpen={true}
    />
  );
}
