import ComplianceListPage from '../../components/ui/ComplianceListPage';
import { useAuth } from '../../context/AuthContext';
import { NAV_CARDS_BY_SECTION } from '../../utils/navCards';

const NAV_CARDS = NAV_CARDS_BY_SECTION['plant-hr'];

export default function PlantHrPending() {
  const { user } = useAuth();
  return (
    <ComplianceListPage
      title={user?.isChd ? 'CHD DASHBOARD' : 'PLANT HR DASHBOARD'}
      listTitle="Pending Compliance"
      headerColor="card-header-pending"
      statusArray={[0, 3, 4, 11, 2]}
      navCards={NAV_CARDS}
    />
  );
}
