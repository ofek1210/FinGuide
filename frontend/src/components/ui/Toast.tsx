export type ToastVariant = "success" | "error" | "warning";

interface ToastProps {
  message: string;
  variant?: ToastVariant;
  onDismiss?: () => void;
}

export default function Toast({ message, variant = "success", onDismiss }: ToastProps) {
  return (
    <div
      className={`toast toast-${variant}`}
      role="status"
      aria-live="polite"
      onClick={onDismiss}
    >
      {message}
    </div>
  );
}
