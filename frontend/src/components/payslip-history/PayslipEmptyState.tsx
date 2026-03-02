interface PayslipEmptyStateProps {
  onUploadNew: () => void;
}

export default function PayslipEmptyState({
  onUploadNew,
}: PayslipEmptyStateProps) {
  return (
    <div className="payslip-state">
      <span>עדיין לא הועלו תלושים.</span>
      <button type="button" onClick={onUploadNew}>
        העלאת תלוש ראשון
      </button>
    </div>
  );
}
