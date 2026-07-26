import type { ThreeCardAdvisoryData } from "../../api/financialAdvisory.types";
import { combinedAdvisoryDisclaimer } from "../../utils/financialAdvisoryDisplay";

type Props = {
  data: ThreeCardAdvisoryData | null | undefined;
};

export default function AdvisoryDisclaimer({ data }: Props) {
  const text = combinedAdvisoryDisclaimer(data);
  if (!text) return null;

  return (
    <p
      style={{
        margin: "16px 2px 0",
        fontSize: 11.5,
        color: "var(--text-faint)",
        lineHeight: 1.55,
      }}
    >
      {text}
    </p>
  );
}
