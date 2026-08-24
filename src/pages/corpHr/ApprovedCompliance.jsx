import ComplianceListPage from '../../components/ui/ComplianceListPage';
import { NAV_CARDS_BY_SECTION } from '../../utils/navCards';

const NAV = NAV_CARDS_BY_SECTION['corp-hr'];

export default function CorpHrApproved() {
  return (
    <ComplianceListPage
      title="CORP HR COMPLIANCE DASHBOARD"
      listTitle="Approved Compliance"
      headerColor="card-header-approved"
      statusArray={[1]}
      navCards={NAV}
    />
  );
}
