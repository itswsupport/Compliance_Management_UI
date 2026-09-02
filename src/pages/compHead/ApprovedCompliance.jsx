import ComplianceListPage from '../../components/ui/ComplianceListPage';
import { NAV_CARDS_BY_SECTION } from '../../utils/navCards';

const NAV = NAV_CARDS_BY_SECTION['comp-head'];

export default function CompHeadApproved() {
  return (
    <ComplianceListPage
      title="COMPLIANCE HEAD DASHBOARD"
      listTitle="Approved Compliance"
      headerColor="card-header-approved"
      statusArray={[1]}
      /* The calendar shows every compliance this approver has touched that is
         still live: waiting on them (0/11), sent back (2), or approved by them
         but not yet closed (1, while a final approval is open). calendarRows
         drops anything effectively APPROVED, so a finished record never draws
         a dot - the same rule the Comp Admin sets state by omitting 1. */
      calendarStatusArray={[0, 1, 2, 4, 11]}
      /* Their legal notices too, drawn in red. A reader has no calendar on
         the Legal Notice screen, so this is the one place they see the two
         sets of deadlines together. */
      calendarLegalNotices={true}
      showCalendar={true}
      navCards={NAV}
    />
  );
}
