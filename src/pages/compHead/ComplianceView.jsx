import ComplianceView from '../compAdmin/ComplianceView';
// Comp Head — first approver in BOTH flows; also 3rd approver in Flow 1 (after CompAdmin)
export default function CompHeadComplianceView() { return <ComplianceView showAction={true} />; }
