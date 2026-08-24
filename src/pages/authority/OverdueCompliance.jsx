import ComplianceListPage from '../../components/ui/ComplianceListPage';
import { NAV_CARDS_BY_SECTION } from '../../utils/navCards';

const NAV = NAV_CARDS_BY_SECTION['authority'];

export default function AuthorityOverdue() {
  return (
    <ComplianceListPage
      title="AUTHORITY DASHBOARD"
      listTitle="Overdue Compliance"
      headerColor="card-header-overdue"
      statusArray={[5]}
      navCards={NAV}
      viewShowAction={false}
    />
  );
}
