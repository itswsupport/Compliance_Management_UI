import ComplianceListPage from '../../components/ui/ComplianceListPage';
import { NAV_CARDS_BY_SECTION } from '../../utils/navCards';

const NAV_CARDS = NAV_CARDS_BY_SECTION['comp-admin'];

export default function CompAdminApproved() {
  return (
    <ComplianceListPage
      title="COMPLIANCE ADMIN DASHBOARD"
      listTitle="Approved Compliance"
      headerColor="card-header-approved"
      statusArray={[1]}
      navCards={NAV_CARDS}
      /* The calendar is offered from every admin tab now, and it draws the same
         month wherever it is opened from — outstanding work, never this tab's
         own rows. An approved compliance is finished and has no deadline left
         to warn about, which is why 1 is absent here exactly as it is on
         Overdue and Pending.

         It does not open by default: only Overdue leads with the calendar. */
      showCalendar={true}
      calendarStatusArray={[0, 3, 4, 11, 2, 5]}
    />
  );
}
