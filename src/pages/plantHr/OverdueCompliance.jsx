import ComplianceListPage from '../../components/ui/ComplianceListPage';
import { useAuth } from '../../context/AuthContext';
import { NAV_CARDS_BY_SECTION } from '../../utils/navCards';

const NAV_CARDS = NAV_CARDS_BY_SECTION['plant-hr'];

export default function PlantHrOverdue() {
  const { user } = useAuth();
  return (
    <ComplianceListPage
      title={user?.isChd ? 'CHD DASHBOARD' : 'PLANT HR DASHBOARD'}
      listTitle="Overdue Compliance"
      headerColor="card-header-overdue"
      statusArray={[0, 5]}
      navCards={NAV_CARDS}
    />
  );
}
