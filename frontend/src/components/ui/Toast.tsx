interface ToastProps {
  message: string;
  onDismiss?: () => void;
}

export default function Toast({ message, onDismiss }: ToastProps) {
  return (
    <div className="toast auth-error" role="status" onClick={onDismiss}>
      {message}
    </div>
  );
}
