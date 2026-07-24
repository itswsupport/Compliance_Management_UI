import ComplianceView from '../compAdmin/ComplianceView';

// Authority view — read-only, no action form (PDF slide 26 shows view-only for authority)
export default function AuthorityComplianceView() {
  return <ComplianceView showAction={false} />;
}
