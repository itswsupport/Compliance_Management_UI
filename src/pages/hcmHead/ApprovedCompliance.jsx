import ComplianceListPage from '../../components/ui/ComplianceListPage';

const NAV = [
  { label: 'Approval Pending',  icon: 'fas fa-spinner',      color: 'bg-c-pending', to: '/hcm-head/pending'  },
  { label: 'Approved Compliance', icon: 'fas fa-check-square', color: 'bg-c-green1',  to: '/hcm-head/approved' },
  { label: 'Rejected Compliance', icon: 'fas fa-times-circle', color: 'bg-c-reject',  to: '/hcm-head/rejected' },
];

export default function HcmHeadApproved() {
  return (
    <ComplianceListPage
      title="HCM HEAD COMPLIANCE DASHBOARD"
      listTitle="Approved Compliance"
      headerColor="card-header-approved"
      statusArray={[1]}
      navCards={NAV}
      viewPath="/hcm-head/view"
    />
  );
}
