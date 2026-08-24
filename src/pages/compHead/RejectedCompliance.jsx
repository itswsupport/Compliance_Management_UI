import ComplianceListPage from '../../components/ui/ComplianceListPage';
import { NAV_CARDS_BY_SECTION } from '../../utils/navCards';

const NAV = NAV_CARDS_BY_SECTION['comp-head'];

export default function CompHeadRejected() {
  return (
    <ComplianceListPage
      title="COMPLIANCE HEAD DASHBOARD"
      listTitle="Rejected Compliance"
      headerColor="card-header-rejected"
      statusArray={[2]}
      navCards={NAV}
    />
  );
}
