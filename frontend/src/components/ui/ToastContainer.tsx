import type { ReactNode } from "react";

interface ToastContainerProps {
  children?: ReactNode;
}

export default function ToastContainer({ children }: ToastContainerProps) {
  if (!children) {
    return null;
  }

  return <div className="toast-container">{children}</div>;
}
