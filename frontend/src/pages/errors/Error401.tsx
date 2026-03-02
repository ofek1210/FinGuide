import ErrorLayout from "./ErrorLayout";

export default function Error401() {
  return (
    <ErrorLayout
      title="401"
      message="כדי להמשיך יש להתחבר לחשבון שלכם."
      actionLabel="מעבר להתחברות"
      actionTo="/login"
    />
  );
}
