import ComplianceView from '../compAdmin/ComplianceView';

// Plant HR — dual role:
//   Flow 2 step 1: Submitter (status 0/5 → shows Submit form)
//   Flow 2 step 2: Approver  (status 11 Level Approval Pending → shows Approve/Reject form)
export default function PlantHrComplianceView() {
  return <ComplianceView showAction={true} />;
}
