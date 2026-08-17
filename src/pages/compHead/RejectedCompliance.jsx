import ComplianceListPage from '../../components/ui/ComplianceListPage';

const NAV = [
  { label: 'Approval Pending',  icon: 'fas fa-spinner',      color: 'bg-c-pending', to: '/comp-head/pending'  },
  { label: 'Approved Compliance', icon: 'fas fa-check-square', color: 'bg-c-green1',  to: '/comp-head/approved' },
  { label: 'Rejected Compliance', icon: 'fas fa-times-circle', color: 'bg-c-reject',  to: '/comp-head/rejected' },
];

export default function CompHeadRejected() {
  return (
    <ComplianceListPage
      title="COMPLIANCE HEAD DASHBOARD"
      listTitle="Rejected Compliance"
      headerColor="card-header-rejected"
      statusArray={[2]}
      navCards={NAV}
    />
  );
}
