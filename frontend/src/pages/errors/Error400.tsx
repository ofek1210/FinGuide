import ErrorLayout from "./ErrorLayout";

export default function Error400() {
  return (
    <ErrorLayout
      title="400"
      message="הבקשה לא תקינה. בדקו את הפרטים ונסו שוב."
      actionLabel="חזרה לדף הבית"
      actionTo="/"
    />
  );
}
