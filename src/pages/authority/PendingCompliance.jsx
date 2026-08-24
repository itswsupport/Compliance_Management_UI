import ComplianceListPage from '../../components/ui/ComplianceListPage';
import { NAV_CARDS_BY_SECTION } from '../../utils/navCards';

const NAV = NAV_CARDS_BY_SECTION['authority'];

export default function AuthorityPending() {
  return (
    <ComplianceListPage
      title="AUTHORITY DASHBOARD"
      listTitle="Pending Compliance"
      headerColor="card-header-pending"
      statusArray={[0, 4]}
      navCards={NAV}
      viewShowAction={false}
    />
  );
}
