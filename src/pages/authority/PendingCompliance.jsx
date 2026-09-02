import ComplianceListPage from '../../components/ui/ComplianceListPage';
import { NAV_CARDS_BY_SECTION } from '../../utils/navCards';

const NAV = NAV_CARDS_BY_SECTION['authority'];

export default function AuthorityPending() {
  return (
    <ComplianceListPage
      title="AUTHORITY DASHBOARD"
      listTitle="Pending Compliance"
      headerColor="card-header-pending"
      /* The four Authority tabs partition compliance_master between them, so
         every status the master can carry has to appear on exactly one of them:
         0/3/4/22 here, 1 Approved, 2 Rejected, 5 Overdue. 3 (Submitted, waiting
         on the Comp Head / Corp HR) was on none of them and those records went
         missing from the dashboard altogether. 22 is waiting on the HCM Head's
         final approval, moved here off Approved. */
      statusArray={[0, 3, 4, 22]}
      navCards={NAV}
      viewShowAction={false}
    />
  );
}
