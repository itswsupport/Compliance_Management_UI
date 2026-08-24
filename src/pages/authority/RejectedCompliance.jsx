import ComplianceListPage from '../../components/ui/ComplianceListPage';
import { NAV_CARDS_BY_SECTION } from '../../utils/navCards';

const NAV = NAV_CARDS_BY_SECTION['authority'];

export default function AuthorityRejected() {
  return (
    <ComplianceListPage
      title="AUTHORITY DASHBOARD"
      listTitle="Rejected Compliance"
      headerColor="card-header-rejected"
      statusArray={[2]}
      navCards={NAV}
      viewShowAction={false}
    />
  );
}
