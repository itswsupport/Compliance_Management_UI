import ComplianceListPage from '../../components/ui/ComplianceListPage';
import { NAV_CARDS_BY_SECTION } from '../../utils/navCards';

const NAV = NAV_CARDS_BY_SECTION['comp-head'];

export default function CompHeadPending() {
  return (
    <ComplianceListPage
      title="COMPLIANCE HEAD DASHBOARD"
      listTitle="Approval Pending"
      headerColor="card-header-pending"
      statusArray={[0, 4, 11]}
      navCards={NAV}
    />
  );
}
