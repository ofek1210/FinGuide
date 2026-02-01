import ErrorLayout from "./ErrorLayout";

export default function Error404() {
  return (
    <ErrorLayout
      title="404"
      message="העמוד שחיפשת לא קיים."
      actionLabel="חזרה לדף הבית"
      actionTo="/"
    />
  );
}
