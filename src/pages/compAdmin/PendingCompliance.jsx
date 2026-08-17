import ComplianceListPage from '../../components/ui/ComplianceListPage';

const NAV_CARDS = [
  { label: 'Assign Compliance',  icon: 'fas fa-plus',         color: 'bg-c-info',    to: '/comp-admin/assign' },
  { label: 'Pending Compliance', icon: 'fas fa-spinner',       color: 'bg-c-pending', to: '/comp-admin/pending' },
  { label: 'Approved Compliance',icon: 'fas fa-check-square',  color: 'bg-c-green1',  to: '/comp-admin/approved' },
  { label: 'Overdue Compliance', icon: 'far fa-hourglass',     color: 'bg-c-draft',   to: '/comp-admin/overdue' },
];

export default function CompAdminPending() {
  return (
    <ComplianceListPage
      title="COMPLIANCE ADMIN DASHBOARD"
      listTitle="Pending Compliance"
      headerColor="card-header-pending"
      statusArray={[0, 3, 4, 11, 2]}
      navCards={NAV_CARDS}
      showDelete={true}
    />
  );
}
