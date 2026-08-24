import ComplianceListPage from '../../components/ui/ComplianceListPage';
import { NAV_CARDS_BY_SECTION } from '../../utils/navCards';

const NAV = NAV_CARDS_BY_SECTION['hcm-head'];

export default function HcmHeadPending() {
  return (
    <ComplianceListPage
      title="HCM HEAD COMPLIANCE DASHBOARD"
      listTitle="Approval Pending"
      headerColor="card-header-pending"
      statusArray={[0, 22]}
      navCards={NAV}
    />
  );
}
