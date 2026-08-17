import ComplianceListPage from '../../components/ui/ComplianceListPage';

const NAV_CARDS = [
  { label: 'Pending Compliance',  icon: 'fas fa-spinner',      color: 'bg-c-pending', to: '/plant-hr/pending'  },
  { label: 'Approved Compliance', icon: 'fas fa-check-square', color: 'bg-c-green1',  to: '/plant-hr/approved' },
  { label: 'Overdue Compliance',  icon: 'far fa-hourglass',    color: 'bg-c-draft',   to: '/plant-hr/overdue'  },
];

export default function PlantHrApproved() {
  return (
    <ComplianceListPage
      title="USER DASHBOARD"
      listTitle="Approved Compliance"
      headerColor="card-header-approved"
      statusArray={[1, 3]}
      navCards={NAV_CARDS}
    />
  );
}
