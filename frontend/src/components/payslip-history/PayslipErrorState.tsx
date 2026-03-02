interface PayslipErrorStateProps {
  message: string;
  onRetry: () => void;
}

export default function PayslipErrorState({
  message,
  onRetry,
}: PayslipErrorStateProps) {
  return (
    <div className="payslip-state is-error">
      <span>{message}</span>
      <button type="button" onClick={onRetry}>
        נסו שוב
      </button>
    </div>
  );
}
