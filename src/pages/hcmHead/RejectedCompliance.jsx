import ComplianceListPage from '../../components/ui/ComplianceListPage';
import { NAV_CARDS_BY_SECTION } from '../../utils/navCards';

const NAV = NAV_CARDS_BY_SECTION['hcm-head'];

export default function HcmHeadRejected() {
  return (
    <ComplianceListPage
      title="HCM HEAD COMPLIANCE DASHBOARD"
      listTitle="Rejected Compliance"
      headerColor="card-header-rejected"
      statusArray={[2]}
      navCards={NAV}
    />
  );
}
