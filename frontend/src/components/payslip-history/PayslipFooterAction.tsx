import { Upload } from "lucide-react";

interface PayslipFooterActionProps {
  onUploadNew: () => void;
}

export default function PayslipFooterAction({
  onUploadNew,
}: PayslipFooterActionProps) {
  return (
    <div className="payslip-footer">
      <button className="payslip-upload" type="button" onClick={onUploadNew}>
        <Upload aria-hidden="true" />
        העלאת תלוש חדש
      </button>
    </div>
  );
}
