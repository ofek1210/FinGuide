interface ToastProps {
  message: string;
  variant?: "error" | "success";
  onDismiss?: () => void;
}

export default function Toast({
  message,
  variant = "error",
  onDismiss,
}: ToastProps) {
  return (
    <div
      className={`toast ${variant === "success" ? "auth-success" : "auth-error"}`}
      role="status"
      onClick={onDismiss}
    >
      {message}
    </div>
  );
}
