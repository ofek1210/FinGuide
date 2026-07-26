import { useNavigate } from "react-router-dom";
import { ArrowLeft, TrendingUp } from "lucide-react";
import type { FullAnalysisGlobalScore } from "../../api/fullAnalysis.api";
import { APP_ROUTES } from "../../types/navigation";
import { RadialGauge } from "./hubViz";

/* ============================================================
   AiScoreCta — bottom-of-page nudge to raise the AI score.
   Shows only after a full run, and only while the score is below
   100%: the same gauge language as the band's health card, with
   a route into the "ציון AI" improvement page.
   ============================================================ */

type AiScoreCtaProps = {
  score: FullAnalysisGlobalScore | null;
};

export default function AiScoreCta({ score }: AiScoreCtaProps) {
  const navigate = useNavigate();
  if (!score || score.score == null || score.score >= 100) return null;

  const remaining = 100 - score.score;

  return (
    <section style={{ marginBottom: 24, animation: "fgRise .5s var(--ease) both" }}>
      <div style={{ position: "relative", overflow: "hidden", borderRadius: "var(--radius)", background: "radial-gradient(120% 120% at 92% 0%,#26242F,#16151B 62%,#0E0D12)", color: "#fff", boxShadow: "var(--shadow-xl)", padding: "26px 30px", display: "flex", alignItems: "center", gap: 26, flexWrap: "wrap" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(255,255,255,.05) 1px,transparent 1px)", backgroundSize: "22px 22px", pointerEvents: "none" }} />

        <div style={{ position: "relative", flex: "none" }}>
          <RadialGauge value={score.score} sub="דיוק הניתוח" tone="lavender" size={116} onDark />
        </div>

        <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 800, letterSpacing: ".1em", color: "var(--lav-300)", marginBottom: 8 }}>
            <TrendingUp size={14} strokeWidth={2.4} /> שיפור ציון ה-AI
          </div>
          <div style={{ fontSize: "clamp(19px,2.2vw,25px)", fontWeight: 900, letterSpacing: "-.02em", lineHeight: 1.2 }}>
            הניתוח שלך מדויק ב-{score.score}%.
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 14.5, lineHeight: 1.6, color: "rgba(255,255,255,.66)", fontWeight: 500, maxWidth: 460 }}>
            עוד {remaining} נקודות להשלמה — כמה פרטים נוספים יחדדו את התמונה ויעלו את דיוק ההמלצות של הסוכן הראשי.
          </p>
        </div>

        <button
          onClick={() => navigate(APP_ROUTES.financialHealth)}
          style={{ position: "relative", flex: "none", display: "inline-flex", alignItems: "center", gap: 9, background: "#fff", color: "var(--ink)", border: "none", borderRadius: "var(--r-btn)", padding: "14px 24px", fontFamily: "inherit", fontWeight: 800, fontSize: 15, cursor: "pointer", transition: "transform .2s var(--ease)" }}
          onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
          onMouseLeave={e => e.currentTarget.style.transform = "none"}
        >
          שיפור ציון ה-AI <ArrowLeft size={17} strokeWidth={2.4} />
        </button>
      </div>
    </section>
  );
}
