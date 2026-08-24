import ComplianceListPage from '../../components/ui/ComplianceListPage';
import { NAV_CARDS_BY_SECTION } from '../../utils/navCards';

const NAV = NAV_CARDS_BY_SECTION['comp-head'];

export default function CompHeadApproved() {
  return (
    <ComplianceListPage
      title="COMPLIANCE HEAD DASHBOARD"
      listTitle="Approved Compliance"
      headerColor="card-header-approved"
      statusArray={[1]}
      navCards={NAV}
    />
  );
}
