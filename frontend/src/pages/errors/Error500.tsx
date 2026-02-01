import ErrorLayout from "./ErrorLayout";

export default function Error500() {
  return (
    <ErrorLayout
      title="500"
      message="משהו השתבש בשרת. נסו שוב מאוחר יותר."
      actionLabel="חזרה לדף הבית"
      actionTo="/"
    />
  );
}
