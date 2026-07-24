import ComplianceListPage from '../../components/ui/ComplianceListPage';

const NAV = [
  { label: 'Pending Compliance',  icon: 'fas fa-spinner',      color: 'bg-c-pending', to: '/authority/pending'  },
  { label: 'Approved Compliance', icon: 'fas fa-check-square', color: 'bg-c-green1',  to: '/authority/approved' },
  { label: 'Rejected Compliance', icon: 'fas fa-times-circle', color: 'bg-c-reject',  to: '/authority/rejected' },
  { label: 'Overdue Compliance',  icon: 'far fa-hourglass',    color: 'bg-c-draft',   to: '/authority/overdue'  },
];

export default function AuthorityOverdue() {
  return (
    <ComplianceListPage
      title="AUTHORITY DASHBOARD"
      listTitle="Overdue Compliance"
      headerColor="card-header-overdue"
      statusArray={[5]}
      navCards={NAV}
      viewPath="/authority/view"
    />
  );
}
