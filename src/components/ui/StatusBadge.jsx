import { getStatusInfo } from '../../utils/formatters';

const VARIANT_CLASSES = {
  warning:  'badge-warning',
  success:  'badge-success',
  danger:   'badge-danger',
  info:     'badge-info',
  primary:  'badge-primary',
  secondary:'badge-secondary bg-gray-100 text-black',
};

export default function StatusBadge({ status, labelOverride, variantOverride }) {
  const info = getStatusInfo(status);
  const label = labelOverride ?? info.label;
  const variant = variantOverride ?? info.variant;
  const variantClass = VARIANT_CLASSES[variant] || VARIANT_CLASSES.secondary;
  return (
    <span className={`badge ${variantClass}`}>
      {label}
    </span>
  );
}
