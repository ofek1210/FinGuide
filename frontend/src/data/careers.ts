/* ────────────────────────────────────────────────
 * Single source of truth for the Careers section.
 * Both the careers landing page and the dynamic
 * /careers/:slug pages read from this module.
 * ──────────────────────────────────────────────── */

export type Department =
  | "Engineering"
  | "Artificial Intelligence"
  | "Infrastructure"
  | "Product"
  | "Design"
  | "Data"
  | "Customer Success";

export type Seniority = "Junior" | "Mid+";

export type Tone = "yellow" | "pink" | "mint" | "purple";

/**
 * FinGuide office is in Tel Aviv. Everyone works the same hybrid model:
 * two days from home, three days in the office.
 */
export const OFFICE_LOCATION = "Tel Aviv";
export const WORK_MODEL = "Hybrid · 2 days from home";

export interface Job {
  /** URL slug — matches the route segment `/careers/:slug` */
  slug: string;
  title: string;
  department: Department;
  /** Always "Tel Aviv" today — kept on the type for future expansion */
  location: typeof OFFICE_LOCATION;
  /** Full employment type label, e.g. "Full Time" */
  type: string;
  /** Junior roles are entry-level. Everything else is Mid+ (3+ years). */
  seniority: Seniority;
  /** Short summary shown on the careers landing page card */
  summary: string;
  /** Longer recruiting-style narrative shown at the top of the job page */
  aboutTheRole: string;
  /** One sentence describing the team the role sits inside */
  teamStructure: string;
  responsibilities: string[];
  required: string[];
  niceToHave: string[];
  tone: Tone;
  /** ISO date the listing was published. Kept static so SEO indexers see stable freshness. */
  datePosted: string;
}

/** All current listings published the same week — keep static to avoid SEO freshness drift. */
const POSTED = "2026-05-15";

export const JOBS: Job[] = [
  {
    slug: "senior-full-stack-engineer",
    title: "Senior Full Stack Engineer",
    department: "Engineering",
    location: OFFICE_LOCATION,
    type: "Full Time",
    seniority: "Mid+",
    summary:
      "Build end-to-end features across frontend and backend systems and shape the technical direction of FinGuide.",
    aboutTheRole:
      "As a Senior Full Stack Engineer at FinGuide you will own product areas end-to-end — from API design to React UI — and partner with Product and Design to turn financial complexity into clear, fast, delightful experiences. You'll set technical direction, mentor other engineers, and lead the way on quality.",
    teamStructure:
      "You will join a tight-knit engineering team of ~10 engineers working in small, full-stack squads alongside Product, Design and Data.",
    responsibilities: [
      "Design, build and ship features end-to-end across the React frontend and Node.js backend.",
      "Own technical decisions for new product areas and document trade-offs.",
      "Lead design reviews and code reviews; raise the engineering bar across the team.",
      "Improve performance, observability and developer experience for the whole codebase.",
      "Mentor mid-level engineers and pair regularly on hard problems.",
    ],
    required: [
      "5+ years building production web applications.",
      "Deep React and TypeScript experience.",
      "Strong Node.js and SQL fundamentals.",
      "Clean REST or GraphQL API design.",
      "Excellent product and UX intuition.",
    ],
    niceToHave: [
      "Fintech or compliance-sensitive product experience.",
      "AWS or GCP infrastructure exposure.",
      "Open-source contributions or technical writing.",
    ],
    tone: "yellow",
    datePosted: POSTED,
  },
  {
    slug: "frontend-engineer",
    title: "Frontend Engineer",
    department: "Engineering",
    location: OFFICE_LOCATION,
    type: "Full Time",
    seniority: "Junior",
    summary:
      "Junior role: build modern, accessible user experiences side-by-side with senior engineers and designers.",
    aboutTheRole:
      "This is a junior position. You'll learn the craft by shipping real product UI in React + TypeScript next to senior engineers and a great design team. Expect deep code review, pair programming and clear paths to grow.",
    teamStructure:
      "You'll work inside a product squad with a PM, Designer, full-stack engineers and a senior frontend engineer who'll mentor you closely.",
    responsibilities: [
      "Implement UI from Figma in React + TypeScript with guidance from senior engineers.",
      "Contribute to the shared design system and component library.",
      "Pair with senior engineers on code review and quality.",
      "Champion accessibility and performance basics as you learn them.",
    ],
    required: [
      "0–2 years of professional experience, or strong personal / academic projects.",
      "Solid React + TypeScript fundamentals.",
      "Good CSS instincts and responsive design awareness.",
      "Hunger to learn — code reviews, pairing, feedback all welcomed.",
    ],
    niceToHave: [
      "Next.js or Vite experience.",
      "Open-source contributions or side projects.",
      "Hebrew RTL experience.",
    ],
    tone: "pink",
    datePosted: POSTED,
  },
  {
    slug: "backend-engineer",
    title: "Backend Engineer",
    department: "Engineering",
    location: OFFICE_LOCATION,
    type: "Full Time",
    seniority: "Mid+",
    summary:
      "Design scalable backend services that power FinGuide's core data pipelines and AI workloads.",
    aboutTheRole:
      "You'll design the services that move money, documents and predictions through FinGuide. From schema design to high-throughput pipelines, you'll own the backbone of the product.",
    teamStructure:
      "You'll partner with full-stack engineers, AI engineers and our DevOps team across a small, focused backend group.",
    responsibilities: [
      "Design service boundaries, APIs and data models.",
      "Build high-throughput pipelines and resilient batch jobs.",
      "Own performance, reliability and security of backend services.",
      "Mentor on testing patterns and code quality.",
    ],
    required: [
      "3+ years of Node.js (Go or Python also welcome).",
      "Strong PostgreSQL and data modeling skills.",
      "Hands-on experience with REST and GraphQL API design.",
      "Solid understanding of distributed systems trade-offs.",
    ],
    niceToHave: ["Event-driven architectures (Kafka, SQS).", "Docker and Kubernetes.", "AWS production experience."],
    tone: "mint",
    datePosted: POSTED,
  },
  {
    slug: "ai-engineer",
    title: "AI Engineer",
    department: "Artificial Intelligence",
    location: OFFICE_LOCATION,
    type: "Full Time",
    seniority: "Mid+",
    summary:
      "Build AI-powered experiences and recommendation systems that turn raw financial data into clear, personalized guidance.",
    aboutTheRole:
      "You'll design and ship the AI surface area of FinGuide — from prompt engineering and RAG pipelines to evaluation harnesses and quality metrics. This is a deeply applied role where research turns into shipped features.",
    teamStructure:
      "You'll work with a small AI guild that crosses product squads, plus a dedicated MLOps partner.",
    responsibilities: [
      "Design prompts, agents and RAG pipelines around state-of-the-art LLMs.",
      "Build evaluation harnesses and quality metrics for AI outputs.",
      "Ship production AI features with strong latency and cost controls.",
      "Stay close to research — bring relevant ideas back into the product.",
    ],
    required: [
      "3+ years of applied ML / AI engineering experience.",
      "Strong Python skills and modern ML tooling.",
      "Hands-on experience with LLMs (OpenAI, Anthropic, or open-source).",
      "Confidence in prompt engineering and RAG patterns.",
      "Good engineering hygiene — testing, versioning, observability.",
    ],
    niceToHave: ["Vector databases (pgvector, Pinecone, Weaviate).", "Fine-tuning or LoRA experience.", "Research publications."],
    tone: "purple",
    datePosted: POSTED,
  },
  {
    slug: "devops-engineer",
    title: "DevOps Engineer",
    department: "Infrastructure",
    location: OFFICE_LOCATION,
    type: "Full Time",
    seniority: "Mid+",
    summary:
      "Build and maintain the cloud infrastructure that powers FinGuide — from CI/CD to multi-environment Kubernetes.",
    aboutTheRole:
      "You'll own the platform every FinGuide engineer ships on top of. From Terraform modules to deployment automation, you'll make production a calm, well-instrumented place to be.",
    teamStructure:
      "You'll work in a small platform team partnering closely with Backend, AI and Security.",
    responsibilities: [
      "Design and operate AWS infrastructure with Terraform.",
      "Own CI/CD pipelines and release automation.",
      "Improve security posture and developer self-service.",
      "Lead capacity planning and cost optimization.",
    ],
    required: [
      "3+ years of DevOps / Platform engineering experience.",
      "Production AWS experience.",
      "Kubernetes in production.",
      "Terraform fluency.",
      "CI/CD (GitHub Actions or equivalent).",
    ],
    niceToHave: ["Service mesh experience (Istio, Linkerd).", "FinOps / cost optimization wins.", "Security engineering background."],
    tone: "yellow",
    datePosted: POSTED,
  },
  {
    slug: "site-reliability-engineer",
    title: "Site Reliability Engineer (SRE)",
    department: "Infrastructure",
    location: OFFICE_LOCATION,
    type: "Full Time",
    seniority: "Mid+",
    summary:
      "Improve reliability, monitoring and operational excellence across the FinGuide stack. Drive SLO culture and incident response.",
    aboutTheRole:
      "You'll be the reliability conscience of FinGuide. You'll define SLOs, lead incident response, and make sure our customers can trust us with the most important financial data they have.",
    teamStructure:
      "You'll sit inside the platform team and partner with every product squad on reliability work.",
    responsibilities: [
      "Define and own SLOs, error budgets and runbooks.",
      "Lead post-mortems and reliability improvement work.",
      "Build observability — metrics, logs, traces — that engineers actually use.",
      "Drive a healthy on-call culture.",
    ],
    required: [
      "3+ years of SRE / production engineering experience.",
      "Linux internals.",
      "Kubernetes in production.",
      "Strong observability stack experience.",
      "Hands-on incident management.",
    ],
    niceToHave: ["Prometheus / Grafana / Coralogix.", "Chaos engineering practice.", "SRE leadership experience."],
    tone: "pink",
    datePosted: POSTED,
  },
  {
    slug: "product-manager",
    title: "Product Manager",
    department: "Product",
    location: OFFICE_LOCATION,
    type: "Full Time",
    seniority: "Mid+",
    summary:
      "Lead product strategy and roadmap execution for one of FinGuide's core product areas.",
    aboutTheRole:
      "As a Product Manager you'll own a product area end-to-end: discovery, definition and delivery. You'll be the connective tissue between users, engineering, design and the business.",
    teamStructure:
      "You'll lead a cross-functional squad of engineers, a designer and a data analyst.",
    responsibilities: [
      "Own a product area end-to-end: discovery, definition and delivery.",
      "Run user research, interviews and quantitative analyses.",
      "Partner with Engineering and Design on weekly delivery.",
      "Set north-star metrics and own the roadmap narrative.",
    ],
    required: [
      "3+ years of B2C or B2B SaaS product management.",
      "Strong analytical thinking with data tools.",
      "Excellent written and verbal communication.",
    ],
    niceToHave: ["Fintech or consumer-finance background.", "Experience shipping AI-driven products.", "Bilingual Hebrew / English."],
    tone: "mint",
    datePosted: POSTED,
  },
  {
    slug: "ux-ui-designer",
    title: "UX/UI Designer",
    department: "Design",
    location: OFFICE_LOCATION,
    type: "Full Time",
    seniority: "Mid+",
    summary:
      "Create intuitive and beautiful experiences for users navigating their financial lives.",
    aboutTheRole:
      "You'll shape how people experience FinGuide — from first onboarding to power-user flows. You'll own design end-to-end, run research, and evolve our design system.",
    teamStructure:
      "You'll work inside a product squad with a PM and engineers, plus a small design guild for craft and direction.",
    responsibilities: [
      "Design end-to-end flows in Figma — from sketches to high-fidelity prototypes.",
      "Run user research and usability tests.",
      "Evolve and maintain FinGuide's design system.",
      "Collaborate tightly with engineering on motion and micro-interactions.",
    ],
    required: [
      "3+ years of product design experience.",
      "Strong portfolio of shipped work.",
      "Figma fluency and design-system practice.",
      "UX research fundamentals.",
    ],
    niceToHave: ["Motion design.", "Hebrew RTL design experience.", "Brand or marketing design background."],
    tone: "purple",
    datePosted: POSTED,
  },
  {
    slug: "data-analyst",
    title: "Data Analyst",
    department: "Data",
    location: OFFICE_LOCATION,
    type: "Full Time",
    seniority: "Junior",
    summary:
      "Junior role: transform data into actionable insights that drive product, growth and operational decisions.",
    aboutTheRole:
      "This is a junior position. You'll learn data craft hands-on — pairing with senior analysts, owning dashboards, and gradually leading deeper analyses across product and growth. Great fit for a strong recent graduate or career-switcher with sharp analytical instincts.",
    teamStructure:
      "You'll work directly with Product, Engineering and Growth leadership, mentored by our lead analyst.",
    responsibilities: [
      "Build and maintain dashboards for product and growth teams.",
      "Run exploratory analyses and present findings to stakeholders.",
      "Partner with Engineering on instrumentation and data quality.",
      "Grow into A/B test design and analysis ownership.",
    ],
    required: [
      "0–2 years of professional experience, or strong analytical academic background.",
      "Solid SQL fundamentals.",
      "Comfort with spreadsheets and BI tools (Looker / Metabase / similar).",
      "Clear communication and curiosity for the 'why' behind the data.",
    ],
    niceToHave: ["Python or R for analysis.", "A/B testing exposure.", "Marketing analytics interest."],
    tone: "yellow",
    datePosted: POSTED,
  },
  {
    slug: "customer-success-manager",
    title: "Customer Success Manager",
    department: "Customer Success",
    location: OFFICE_LOCATION,
    type: "Full Time",
    seniority: "Mid+",
    summary:
      "Help customers maximize value from FinGuide — from onboarding through expansion and renewal.",
    aboutTheRole:
      "You'll be the trusted advisor for our customers. You'll own the post-sales relationship, drive adoption and bring the voice of the customer back to the product team.",
    teamStructure:
      "You'll partner with Sales, Product and Support inside a small customer-facing team.",
    responsibilities: [
      "Own customer relationships through the full lifecycle.",
      "Drive adoption, satisfaction and retention.",
      "Bring customer voice back to Product and Engineering.",
      "Run QBRs and renewal conversations.",
    ],
    required: [
      "3+ years in SaaS Customer Success or Account Management.",
      "Excellent communication skills.",
      "Customer-first mindset.",
    ],
    niceToHave: ["Fintech background.", "Hebrew + English fluency.", "Experience with CS tooling (Gainsight, Vitally)."],
    tone: "pink",
    datePosted: POSTED,
  },
];

/* ────────────────────────────────────────────────
 * Helpers
 * ──────────────────────────────────────────────── */

export function getJobBySlug(slug: string): Job | undefined {
  return JOBS.find((j) => j.slug === slug);
}

export function getRelatedJobs(slug: string, limit = 3): Job[] {
  const current = getJobBySlug(slug);
  if (!current) return JOBS.slice(0, limit);
  // Prefer jobs from the same department, then fall back to others
  const sameDept = JOBS.filter(
    (j) => j.slug !== slug && j.department === current.department
  );
  const others = JOBS.filter(
    (j) => j.slug !== slug && j.department !== current.department
  );
  return [...sameDept, ...others].slice(0, limit);
}

export const DEPARTMENTS: Department[] = [
  "Engineering",
  "Artificial Intelligence",
  "Infrastructure",
  "Product",
  "Design",
  "Data",
  "Customer Success",
];

export const SENIORITIES: Seniority[] = ["Junior", "Mid+"];

/* ────────────────────────────────────────────────
 * Supporting content (used on the landing page)
 * ──────────────────────────────────────────────── */

export interface ReasonCard {
  icon: string;
  title: string;
  body: string;
  tone: Tone;
}

export const REASONS: ReasonCard[] = [
  { icon: "🚀", title: "השפעה אמיתית", body: "עבודה על מוצר שמשפיע על משתמשים אמיתיים — לא הוכחת היתכנות.", tone: "yellow" },
  { icon: "🤖", title: "טכנולוגיות מתקדמות", body: "AI, Cloud, Data ו-Web — סטאק מודרני, החלטות אדריכליות אמיתיות.", tone: "pink" },
  { icon: "📈", title: "צמיחה מקצועית", body: "למידה מתמדת, mentorship, תקציב לקורסים וכנסים.", tone: "mint" },
  { icon: "🌍", title: "עבודה היברידית", body: "משרד בתל אביב, יומיים מהבית כל שבוע — גמישות אמיתית.", tone: "purple" },
  { icon: "💡", title: "חדשנות", body: "חופש לחשוב, להציע ולבנות. רעיון טוב מנצח היררכיה.", tone: "yellow" },
  { icon: "❤️", title: "אנשים טובים", body: "תרבות פתוחה, שיתופית — אנחנו אוהבים את מי שאנחנו עובדים איתו.", tone: "pink" },
];

export interface CultureItem {
  icon: string;
  label: string;
  tone: Tone;
}

export const CULTURE_ITEMS: CultureItem[] = [
  { icon: "🤝", label: "שיתופי פעולה", tone: "yellow" },
  { icon: "⚡", label: "Hackathons", tone: "pink" },
  { icon: "📚", label: "Learning Sessions", tone: "mint" },
  { icon: "🎉", label: "ארועי חברה", tone: "purple" },
  { icon: "💥", label: "Innovation Days", tone: "yellow" },
  { icon: "🧠", label: "Knowledge Sharing", tone: "pink" },
];

export interface Stat {
  value: number;
  suffix: string;
  label: string;
  tone: Tone;
}

export const STATS: Stat[] = [
  { value: 25, suffix: "+", label: "Employees", tone: "yellow" },
  { value: 3, suffix: "", label: "Countries", tone: "pink" },
  { value: 10, suffix: "+", label: "Open Positions", tone: "mint" },
  { value: 100, suffix: "%", label: "Growth Mindset", tone: "purple" },
];

export interface Benefit {
  icon: string;
  title: string;
  tone: Tone;
}

export const BENEFITS: Benefit[] = [
  { icon: "🏥", title: "ביטוח בריאות", tone: "yellow" },
  { icon: "📚", title: "תקציב ללמידה מקצועית", tone: "pink" },
  { icon: "💻", title: "ציוד עבודה מתקדם", tone: "mint" },
  { icon: "🏠", title: "היברידי · יומיים מהבית", tone: "purple" },
  { icon: "☕", title: "Happy Hours", tone: "yellow" },
  { icon: "🌴", title: "ימי חופשה גמישים", tone: "pink" },
];

export interface Step {
  num: string;
  title: string;
  body: string;
  tone: Tone;
}

export const STEPS: Step[] = [
  { num: "01", title: "שיחת היכרות", body: "שיחה קצרה (~30 דק׳) להבין מה מחפשים ולמה.", tone: "yellow" },
  { num: "02", title: "ראיון מקצועי", body: "צלילה לתחום שלכם עם ראש הצוות הרלוונטי.", tone: "pink" },
  { num: "03", title: "משימה קצרה", body: "תרגיל פרקטי קצר (אם רלוונטי לתפקיד).", tone: "mint" },
  { num: "04", title: "פגישה עם הצוות", body: "פגישה עם מי שתעבדו איתם יום-יום.", tone: "purple" },
  { num: "05", title: "הצטרפות 🚀", body: "מצטרפים למשפחת FinGuide.", tone: "yellow" },
];

export interface Testimonial {
  quote: string;
  name: string;
  role: string;
  /** Public path to the portrait image */
  avatar: string;
  tone: Tone;
}

export const TESTIMONIALS: Testimonial[] = [
  {
    quote: "אחד המקומות הכי טובים שעבדתי בהם. אנשים מצוינים, אתגרים אמיתיים ומוצר שאפשר להיות גאים בו.",
    name: "דניאל שלום",
    role: "Backend Engineer",
    avatar: "/testimonials/daniel.svg",
    tone: "yellow",
  },
  {
    quote: "כאן באמת מקשיבים לעובדים. הרגשתי שיש לי השפעה אמיתית על המוצר כבר מהשבועות הראשונים.",
    name: "מאיה ליפל",
    role: "Product Manager",
    avatar: "/testimonials/maya.svg",
    tone: "pink",
  },
  {
    quote: "השילוב בין טכנולוגיה מתקדמת לאנשים מדהימים יוצר סביבה שקשה לתאר. פשוט בא להגיע לעבודה.",
    name: "יואב כץ",
    role: "AI Engineer",
    avatar: "/testimonials/yoav.svg",
    tone: "mint",
  },
];
