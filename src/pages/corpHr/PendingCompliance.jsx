import ComplianceListPage from '../../components/ui/ComplianceListPage';
import { NAV_CARDS_BY_SECTION } from '../../utils/navCards';

const NAV = NAV_CARDS_BY_SECTION['corp-hr'];

export default function CorpHrPending() {
  return (
    <ComplianceListPage
      title="CORP HR COMPLIANCE DASHBOARD"
      listTitle="Approval Pending"
      headerColor="card-header-pending"
      statusArray={[0, 11]}
      navCards={NAV}
    />
  );
}
