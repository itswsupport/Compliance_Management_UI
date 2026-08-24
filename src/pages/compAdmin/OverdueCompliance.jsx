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
      navCards={NAV_CARDS}
      showCalendar={true}
      calendarDefaultOpen={true}
    />
  );
}
