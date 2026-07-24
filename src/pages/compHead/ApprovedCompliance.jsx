import ComplianceListPage from '../../components/ui/ComplianceListPage';

const NAV = [
  { label: 'Approval Pending',  icon: 'fas fa-spinner',      color: 'bg-c-pending', to: '/comp-head/pending'  },
  { label: 'Approved Compliance', icon: 'fas fa-check-square', color: 'bg-c-green1',  to: '/comp-head/approved' },
  { label: 'Rejected Compliance', icon: 'fas fa-window-close', color: 'bg-c-reject',  to: '/comp-head/rejected' },
];

export default function CompHeadApproved() {
  return (
    <ComplianceListPage
      title="COMPLIANCE HEAD DASHBOARD"
      listTitle="Approved Compliance"
      headerColor="card-header-approved"
      statusArray={[1]}
      navCards={NAV}
      viewPath="/comp-head/view"
    />
  );
}
