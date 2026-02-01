import ErrorLayout from "./ErrorLayout";

export default function Error403() {
  return (
    <ErrorLayout
      title="403"
      message="אין לך הרשאה לצפות בעמוד הזה."
      actionLabel="חזרה לדף הבית"
      actionTo="/"
    />
  );
}
