import ComplianceListPage from '../../components/ui/ComplianceListPage';

const NAV = [
  { label: 'Approval Pending',  icon: 'fas fa-spinner',      color: 'bg-c-pending', to: '/corp-hr/pending'  },
  { label: 'Approved Compliance', icon: 'fas fa-check-square', color: 'bg-c-green1',  to: '/corp-hr/approved' },
  { label: 'Rejected Compliance', icon: 'fas fa-times-circle', color: 'bg-c-reject',  to: '/corp-hr/rejected' },
];

export default function CorpHrRejected() {
  return (
    <ComplianceListPage
      title="CORP HR COMPLIANCE DASHBOARD"
      listTitle="Rejected Compliance"
      headerColor="card-header-rejected"
      statusArray={[2]}
      navCards={NAV}
      viewPath="/corp-hr/view"
    />
  );
}
