import ComplianceListPage from '../../components/ui/ComplianceListPage';
import { NAV_CARDS_BY_SECTION } from '../../utils/navCards';

const NAV = NAV_CARDS_BY_SECTION['authority'];

export default function AuthorityApproved() {
  return (
    <ComplianceListPage
      title="AUTHORITY DASHBOARD"
      listTitle="Approved Compliance"
      headerColor="card-header-approved"
      statusArray={[1]}
      navCards={NAV}
      viewShowAction={false}
    />
  );
}
