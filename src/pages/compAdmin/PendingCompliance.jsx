import ComplianceListPage from '../../components/ui/ComplianceListPage';
import { NAV_CARDS_BY_SECTION } from '../../utils/navCards';

const NAV_CARDS = NAV_CARDS_BY_SECTION['comp-admin'];

export default function CompAdminPending() {
  return (
    <ComplianceListPage
      title="COMPLIANCE ADMIN DASHBOARD"
      listTitle="Pending Compliance"
      headerColor="card-header-pending"
      statusArray={[0, 3, 4, 11, 2, 22]}
      navCards={NAV_CARDS}
      showDelete={true}
      /* The calendar is offered here as well as on Overdue, but it does NOT
         open by default — this tab leads with its list, and only Overdue opens
         on the calendar. Its rows are everything still outstanding, the same
         set Overdue's calendar draws, so the two show the same month whichever
         tab you toggle it from. */
      showCalendar={true}
      calendarStatusArray={[0, 3, 4, 11, 2, 5]}
    />
  );
}
