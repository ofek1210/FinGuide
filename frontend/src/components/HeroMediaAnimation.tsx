import { BarChart3, FileText, ShieldCheck, Wand2 } from "lucide-react";

/**
 * Hero media — Rapyd-style billboard:
 *   layer 1  posterized duotone screenshot (CSS ::before)
 *   layer 2  neon mint/yellow glow overlay  (CSS ::after)
 *   layer 3  Bebas headline               (DOM .hero-media-billboard)
 *   layer 4  floating colored stickers    (DOM .hero-sticker)
 *
 * All decorative — no state, no props, no effects.
 */
export default function HeroMediaAnimation() {
  return (
    <div className="hero-media-animation" aria-hidden="true">
      <span className="hero-media-billboard">
        UPLOAD.
        <br />
        ANALYZE.
        <br />
        UNDERSTAND.
      </span>
      <div className="hero-media-stickers">
        <span className="hero-sticker hero-sticker--yellow">
          <FileText strokeWidth={2.5} />
        </span>
        <span className="hero-sticker hero-sticker--mint">
          <Wand2 strokeWidth={2.5} />
        </span>
        <span className="hero-sticker hero-sticker--purple">
          <BarChart3 strokeWidth={2.5} />
        </span>
        <span className="hero-sticker hero-sticker--white">
          <ShieldCheck strokeWidth={2.5} />
        </span>
      </div>
    </div>
  );
}
