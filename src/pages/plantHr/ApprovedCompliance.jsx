import ComplianceListPage from '../../components/ui/ComplianceListPage';
import { useAuth } from '../../context/AuthContext';
import { NAV_CARDS_BY_SECTION } from '../../utils/navCards';

const NAV_CARDS = NAV_CARDS_BY_SECTION['plant-hr'];

export default function PlantHrApproved() {
  const { user } = useAuth();
  return (
    <ComplianceListPage
      title={user?.isChd ? 'CHD DASHBOARD' : 'PLANT HR DASHBOARD'}
      listTitle="Approved Compliance"
      headerColor="card-header-approved"
      statusArray={[1, 3]}
      navCards={NAV_CARDS}
    />
  );
}
