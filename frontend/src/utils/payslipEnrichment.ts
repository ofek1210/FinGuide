import type { DocumentItem } from "../api/documents.api";

export type EnrichedPayslip = {
  grossSalary: number | null;
  netSalary: number | null;
  tax: number | null;
  nationalInsurance: number | null;
  healthInsurance: number | null;
  mandatoryTotal: number | null;
  pensionEmployee: number | null;
  pensionEmployer: number | null;
  studyFundEmployee: number | null;
  studyFundEmployer: number | null;
  vacationDays: number | null;
  sickDays: number | null;
};

export type MoneyFlowItem = {
  label: string;
  avgAmount: number;
  pctOfGross: number;
  pctOfGap: number;
};

export type MoneyFlow = {
  payslipCount: number;
  avgGross: number;
  avgNet: number;
  totalWithheld: number;
  items: MoneyFlowItem[];
};

type AnalysisShape = {
  summary?: Record<string, unknown>;
  salary?: {
    gross_total?: number;
    net_payable?: number;
    components?: Array<{ amount?: number }>;
  };
  deductions?: {
    mandatory?: {
      total?: number;
      income_tax?: number;
      national_insurance?: number;
      health_insurance?: number;
    };
  };
  contributions?: {
    pension?: {
      employee?: number;
      employee_amount?: number;
      employer?: number;
      employer_amount?: number;
      base_salary_for_pension?: number;
    };
    study_fund?: {
      employee?: number;
      employee_amount?: number;
      employer?: number;
      employer_amount?: number;
    };
  };
  tax?: {
    gross_for_income_tax?: number;
    tax_credit_points?: number | null;
  };
};

function toNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toPositiveSalary(v: unknown): number | null {
  const n = toNum(v);
  return n != null && n > 0 ? n : null;
}

function isGrossPlausible(gross: number | null, salary?: AnalysisShape["salary"]): boolean {
  if (!Number.isFinite(gross) || (gross as number) <= 0) return false;
  const components = salary?.components;
  if (!Array.isArray(components) || !components.length) return true;
  const maxComponent = components.reduce((max, c) => {
    const amount = toNum(c.amount) ?? 0;
    return Math.max(max, amount);
  }, 0);
  return (gross as number) >= maxComponent;
}

function readPensionEmployee(analysis: AnalysisShape): number | null {
  const summary = analysis.summary || {};
  const pension = analysis.contributions?.pension || {};
  return toNum(summary.pensionEmployee)
    ?? toNum(pension.employee_amount)
    ?? toNum(pension.employee);
}

function readPensionEmployer(analysis: AnalysisShape): number | null {
  const summary = analysis.summary || {};
  const pension = analysis.contributions?.pension || {};
  return toNum(summary.pensionEmployer)
    ?? toNum(pension.employer_amount)
    ?? toNum(pension.employer);
}

function readStudyEmployee(analysis: AnalysisShape): number | null {
  const summary = analysis.summary || {};
  const study = analysis.contributions?.study_fund || {};
  return toNum(summary.trainingFundEmployee)
    ?? toNum(study.employee_amount)
    ?? toNum(study.employee);
}

function readStudyEmployer(analysis: AnalysisShape): number | null {
  const summary = analysis.summary || {};
  const study = analysis.contributions?.study_fund || {};
  return toNum(summary.trainingFundEmployer)
    ?? toNum(study.employer_amount)
    ?? toNum(study.employer);
}

export function enrichPayslipFromDoc(doc: DocumentItem): EnrichedPayslip {
  const analysis = (doc.analysisData || {}) as AnalysisShape;
  return enrichPayslipFromAnalysis(analysis);
}

export function enrichPayslipFromAnalysis(analysis: AnalysisShape): EnrichedPayslip {
  if (!analysis || typeof analysis !== "object") {
    return {
      grossSalary: null,
      netSalary: null,
      tax: null,
      nationalInsurance: null,
      healthInsurance: null,
      mandatoryTotal: null,
      pensionEmployee: null,
      pensionEmployer: null,
      studyFundEmployee: null,
      studyFundEmployer: null,
      vacationDays: null,
      sickDays: null,
    };
  }

  const summary = analysis.summary || {};
  const salary = analysis.salary || {};
  const deductions = analysis.deductions?.mandatory || {};
  const contributions = analysis.contributions || {};
  const tax = analysis.tax || {};

  const rawGross = toPositiveSalary(summary.grossSalary) ?? toPositiveSalary(salary.gross_total);
  const grossSalary = isGrossPlausible(rawGross, salary)
    ? rawGross
    : (toPositiveSalary(contributions?.pension?.base_salary_for_pension)
        ?? toPositiveSalary(tax.gross_for_income_tax)
        ?? toPositiveSalary(salary.gross_total)
        ?? rawGross);

  const rawNet = toPositiveSalary(summary.netSalary) ?? toPositiveSalary(salary.net_payable);
  const grossForNetCheck = grossSalary ?? toPositiveSalary(tax.gross_for_income_tax);
  const netIsPlausible = Number.isFinite(rawNet) && Number.isFinite(grossForNetCheck)
    && (grossForNetCheck as number) > 0
    && ((rawNet as number) / (grossForNetCheck as number)) >= 0.3;

  const mandatoryTotal = toNum(deductions.total);
  const pensionEmployee = readPensionEmployee(analysis) ?? 0;
  const derivedNet = (() => {
    if (!Number.isFinite(grossForNetCheck)) return null;
    if (!Number.isFinite(mandatoryTotal)) {
      const taxAmt = toNum(deductions.income_tax) ?? 0;
      const niAmt = toNum(deductions.national_insurance) ?? 0;
      const hiAmt = toNum(deductions.health_insurance) ?? 0;
      const studyAmt = readStudyEmployee(analysis) ?? 0;
      const partial = taxAmt + niAmt + hiAmt + pensionEmployee + studyAmt;
      if (partial <= 0) return null;
      return Math.round(((grossForNetCheck as number) - partial) * 100) / 100;
    }
    return Math.round(((grossForNetCheck as number) - (mandatoryTotal as number) - pensionEmployee) * 100) / 100;
  })();
  const netSalary = netIsPlausible ? rawNet : (derivedNet ?? rawNet);

  return {
    grossSalary,
    netSalary,
    tax: toNum(summary.tax) ?? toNum(deductions.income_tax),
    nationalInsurance: toNum(summary.nationalInsurance) ?? toNum(deductions.national_insurance),
    healthInsurance: toNum(summary.healthInsurance) ?? toNum(deductions.health_insurance),
    mandatoryTotal,
    pensionEmployee: readPensionEmployee(analysis),
    pensionEmployer: readPensionEmployer(analysis),
    studyFundEmployee: readStudyEmployee(analysis),
    studyFundEmployer: readStudyEmployer(analysis),
    vacationDays: toNum(summary.vacationDays),
    sickDays: toNum(summary.sickDays),
  };
}

function avgField(list: EnrichedPayslip[], key: keyof EnrichedPayslip): number | null {
  const nums = list.map(e => e[key]).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (!nums.length) return null;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

const FLOW_LABELS: Array<{ key: keyof EnrichedPayslip; label: string }> = [
  { key: "tax", label: "מס הכנסה" },
  { key: "nationalInsurance", label: "ביטוח לאומי" },
  { key: "healthInsurance", label: "מס בריאות" },
  { key: "pensionEmployee", label: "הפקדה לפנסיה (עובד)" },
  { key: "studyFundEmployee", label: "קרן השתלמות (עובד)" },
];

export function buildMoneyFlow(enrichedList: EnrichedPayslip[]): MoneyFlow | null {
  const valid = enrichedList.filter(
    e => Number.isFinite(e.grossSalary) && Number.isFinite(e.netSalary),
  );
  if (!valid.length) return null;

  const avgGross = avgField(valid, "grossSalary");
  const avgNet = avgField(valid, "netSalary");
  if (!Number.isFinite(avgGross) || !Number.isFinite(avgNet)) return null;

  const totalWithheld = Math.round((avgGross as number) - (avgNet as number));
  const items: MoneyFlowItem[] = FLOW_LABELS
    .map(({ key, label }) => {
      const avgAmount = avgField(valid, key);
      if (!Number.isFinite(avgAmount) || (avgAmount as number) <= 0) return null;
      return {
        label,
        avgAmount: avgAmount as number,
        pctOfGross: Math.round(((avgAmount as number) / (avgGross as number)) * 1000) / 10,
        pctOfGap: totalWithheld > 0
          ? Math.round(((avgAmount as number) / totalWithheld) * 1000) / 10
          : 0,
      };
    })
    .filter((i): i is MoneyFlowItem => i !== null);

  const itemised = items.reduce((s, i) => s + i.avgAmount, 0);
  const remainder = totalWithheld - itemised;
  if (remainder > 50) {
    items.push({
      label: "ניכויים נוספים / אחר",
      avgAmount: Math.round(remainder),
      pctOfGross: Math.round((remainder / (avgGross as number)) * 1000) / 10,
      pctOfGap: totalWithheld > 0 ? Math.round((remainder / totalWithheld) * 1000) / 10 : 0,
    });
  }

  items.sort((a, b) => b.avgAmount - a.avgAmount);

  return {
    payslipCount: valid.length,
    avgGross: avgGross as number,
    avgNet: avgNet as number,
    totalWithheld,
    items,
  };
}

export function avgEnriched(list: EnrichedPayslip[], key: keyof EnrichedPayslip): number | null {
  return avgField(list, key);
}
