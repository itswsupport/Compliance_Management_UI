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
      calendarStatusArrays={[[0, 3, 4, 11, 2], [0, 5]]}
      /* Only for a CHD. A Plant HR has Legal Notice in the sidebar and a
         calendar of their own behind it, so drawing the notices here as well
         would be the same month in two places. A CHD has no sidebar entry -
         they reach legal notices by the card - so this is their only
         calendar view of them. */
      calendarLegalNotices={!user?.isPlantHr}
      showCalendar={true}
      navCards={NAV_CARDS}
    />
  );
}
