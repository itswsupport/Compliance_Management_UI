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
    />
  );
}
