export type ToastVariant = "error" | "warning" | "success";

interface ToastProps {
  message: string;
  variant?: ToastVariant;
  onDismiss?: () => void;
}

const variantToClass: Record<ToastVariant, string> = {
  error: "toast--error",
  warning: "toast--warning",
  success: "toast--success",
};

export default function Toast({
  message,
  variant = "error",
  onDismiss,
}: ToastProps) {
  return (
    <div
      className={`toast ${variantToClass[variant]}`}
      role="status"
      aria-live="polite"
      onClick={onDismiss}
    >
      {message}
    </div>
  );
}
