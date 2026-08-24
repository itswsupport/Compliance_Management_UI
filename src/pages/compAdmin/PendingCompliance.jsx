import ComplianceListPage from '../../components/ui/ComplianceListPage';
import { NAV_CARDS_BY_SECTION } from '../../utils/navCards';

const NAV_CARDS = NAV_CARDS_BY_SECTION['comp-admin'];

export default function CompAdminPending() {
  return (
    <ComplianceListPage
      title="COMPLIANCE ADMIN DASHBOARD"
      listTitle="Pending Compliance"
      headerColor="card-header-pending"
      statusArray={[0, 3, 4, 11, 2]}
      navCards={NAV_CARDS}
      showDelete={true}
    />
  );
}
