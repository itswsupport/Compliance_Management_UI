import ComplianceListPage from '../../components/ui/ComplianceListPage';
import { NAV_CARDS_BY_SECTION } from '../../utils/navCards';

const NAV = NAV_CARDS_BY_SECTION['hcm-head'];

export default function HcmHeadApproved() {
  return (
    <ComplianceListPage
      title="HCM HEAD COMPLIANCE DASHBOARD"
      listTitle="Approved Compliance"
      headerColor="card-header-approved"
      statusArray={[1]}
      navCards={NAV}
    />
  );
}
