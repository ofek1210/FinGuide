interface PayslipEmptyStateProps {
  onUploadNew: () => void;
}

export default function PayslipEmptyState({
  onUploadNew,
}: PayslipEmptyStateProps) {
  return (
    <div className="payslip-state">
      <span>עדיין אין תלושים להצגה. מוצגים רק מסמכים שעובדו בהצלחה (סטטוס הושלם).</span>
      <button type="button" onClick={onUploadNew}>
        העלאת תלוש ראשון
      </button>
    </div>
  );
}
