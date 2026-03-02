import Loader from "../ui/Loader";

export default function PayslipLoadingState() {
  return (
    <div className="payslip-state">
      <Loader />
      <span>טוענים היסטוריית תלושים...</span>
    </div>
  );
}
