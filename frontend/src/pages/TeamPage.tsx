import { useNavigate } from "react-router-dom";
import { ArrowUpRight, Linkedin } from "lucide-react";
import { APP_ROUTES } from "../types/navigation";
import PublicPageShell from "../components/landing/PublicPageShell";
import "../components/landing/landing-team.css";

type Tone = "yellow" | "pink" | "mint" | "purple";

interface TeamMember {
  name: string;
  role: string;
  description: string;
  image: string;
  tone: Tone;
  linkedin?: string;
}

const TEAM: TeamMember[] = [
  {
    name: "Segev Partush",
    role: "Co-Founder & CEO",
    description: "Leading company strategy, business growth, and execution.",
    image: "/team/SegevPartush.jpg",
    tone: "yellow",
  },
  {
    name: "Ofek Dil",
    role: "Co-Founder & CTO",
    description: "Driving the technical vision and platform architecture.",
    image: "/team/OfekDil.png",
    tone: "pink",
  },
  {
    name: "Emily Belenky",
    role: "Co-Founder & Head of Reliability Engineering",
    description: "Building scalable, resilient, and highly available systems.",
    image: "/team/EmilyBelenky.jpeg",
    tone: "mint",
  },
  {
    name: "Shahar Mayster",
    role: "Co-Founder & VP of R&D",
    description: "Leading engineering teams and product development.",
    image: "/team/ShaharMayster.jpeg",
    tone: "purple",
  },
  {
    name: "Ofir Raz",
    role: "Co-Founder & Chief Product Officer",
    description:
      "Defining product strategy and turning customer needs into impactful solutions.",
    image: "/team/OfirRaz.jpeg",
    tone: "yellow",
  },
];

export default function TeamPage() {
  const navigate = useNavigate();

  return (
    <PublicPageShell contentClassName="team-page">
      <main className="team-main">
        <section className="team-hero">
          <div className="team-hero-inner landing-container">
            <span className="team-hero-eyebrow">הכר את הצוות</span>
            <h1 className="team-hero-title">
              האנשים שמאחורי <strong>FinGuide</strong>
            </h1>
            <p className="team-hero-subtitle">
              בונים טכנולוגיה פיננסית אמינה, סקלבילית וממוקדת משתמש —
              <br />
              כדי שכל אחד יוכל להבין את הכסף שלו.
            </p>
          </div>
        </section>

        <section className="team-chapter landing-container" aria-labelledby="team-chapter-title">
          <span className="team-chapter-eyebrow">הצוות</span>
          <h2 id="team-chapter-title" className="team-chapter-title">
            <span>5 מייסדים.</span>
            <strong>חזון אחד.</strong>
          </h2>
          <p className="team-chapter-sub">
            האנשים שמאחורי הקלעים — והכוח שמניע את FinGuide קדימה.
          </p>
          <span className="team-chapter-rule" aria-hidden="true" />
        </section>

        <section className="team-banner landing-container" aria-label="Team photo">
          <div className="team-banner-frame">
            <img
              src="/team/EveryBody.png"
              alt="כל חברי הצוות של FinGuide ביחד במשרד"
              width={1919}
              height={820}
              loading="lazy"
              decoding="async"
            />
            <span className="team-banner-tag team-banner-tag-tl">FOUNDERS</span>
            <span className="team-banner-tag team-banner-tag-br">EST. 2026</span>
          </div>
        </section>

        <section className="team-grid-section landing-container">
          <ul className="team-grid" role="list">
            {TEAM.map((member) => (
              <li key={member.name} className={`team-card tone-${member.tone}`}>
                <figure className="team-card-portrait">
                  <img
                    src={member.image}
                    alt={`${member.name} — ${member.role}`}
                    loading="lazy"
                    decoding="async"
                  />
                </figure>
                <div className="team-card-body">
                  <p className="team-card-role">{member.role}</p>
                  <h2 className="team-card-name">{member.name}</h2>
                  <p className="team-card-description">{member.description}</p>
                  {member.linkedin ? (
                    <a
                      className="team-card-linkedin"
                      href={member.linkedin}
                      target="_blank"
                      rel="noreferrer noopener"
                      aria-label={`LinkedIn — ${member.name}`}
                    >
                      <Linkedin aria-hidden="true" />
                      <span>LinkedIn</span>
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="team-cta landing-container">
          <div className="team-cta-card">
            <h2>בואו לעבוד איתנו</h2>
            <p>
              נשמח להכיר אנשים שמתלהבים מנתונים, מ-AI, ומלהפוך מסמכים פיננסיים
              לבהירות אמיתית. אם זה אתם — נשמח לדבר.
            </p>
            <button
              className="landing-primary team-cta-btn"
              type="button"
              onClick={() => navigate(APP_ROUTES.contact)}
            >
              צור קשר
              <ArrowUpRight aria-hidden="true" />
            </button>
          </div>
        </section>
      </main>
    </PublicPageShell>
  );
}
