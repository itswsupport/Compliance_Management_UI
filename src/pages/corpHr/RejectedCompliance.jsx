import ComplianceListPage from '../../components/ui/ComplianceListPage';
import { NAV_CARDS_BY_SECTION } from '../../utils/navCards';

const NAV = NAV_CARDS_BY_SECTION['corp-hr'];

export default function CorpHrRejected() {
  return (
    <ComplianceListPage
      title="CORP HR COMPLIANCE DASHBOARD"
      listTitle="Rejected Compliance"
      headerColor="card-header-rejected"
      statusArray={[2]}
      navCards={NAV}
    />
  );
}
