import type { PayslipDetail, PayslipHistoryResponse } from "../types/payslip";

const MOCK_DELAY_MS = 500;

const MOCK_RESPONSE: PayslipHistoryResponse = {
  stats: {
    averageNet: 18030,
    averageGross: 23833,
    totalPayslips: 6,
  },
  items: [
    {
      id: "payslip-2025-03",
      periodLabel: "מרץ 2025",
      periodDate: "2025-03-01",
      netSalary: 17820,
      grossSalary: 24000,
      isLatest: true,
      downloadUrl: null,
    },
    {
      id: "payslip-2025-02",
      periodLabel: "פברואר 2025",
      periodDate: "2025-02-01",
      netSalary: 18450,
      grossSalary: 24000,
      isLatest: false,
      downloadUrl: null,
    },
    {
      id: "payslip-2025-01",
      periodLabel: "ינואר 2025",
      periodDate: "2025-01-01",
      netSalary: 18320,
      grossSalary: 24000,
      isLatest: false,
      downloadUrl: null,
    },
    {
      id: "payslip-2024-12",
      periodLabel: "דצמבר 2024",
      periodDate: "2024-12-01",
      netSalary: 17950,
      grossSalary: 23500,
      isLatest: false,
      downloadUrl: null,
    },
    {
      id: "payslip-2024-11",
      periodLabel: "נובמבר 2024",
      periodDate: "2024-11-01",
      netSalary: 17880,
      grossSalary: 23500,
      isLatest: false,
      downloadUrl: null,
    },
    {
      id: "payslip-2024-10",
      periodLabel: "אוקטובר 2024",
      periodDate: "2024-10-01",
      netSalary: 17760,
      grossSalary: 23500,
      isLatest: false,
      downloadUrl: null,
    },
  ],
};

const delay = (ms: number) =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

/** Mock payslip detail – replace with API call when OCR/backend is ready */
const MOCK_DETAILS: Record<string, PayslipDetail> = {
  "payslip-2025-03": {
    id: "payslip-2025-03",
    periodLabel: "מרץ 2025",
    periodDate: "2025-03-01",
    paymentDate: "2025-04-01",
    employerName: "חברת דוגמה בע\"מ",
    employeeName: "ישראל ישראלי",
    employeeId: "123456789",
    earnings: [
      { label: "משכורת בסיס", amount: 22000 },
      { label: "שעות נוספות", amount: 1500 },
      { label: "השלמת משכורת", amount: 500 },
    ],
    deductions: [
      { label: "מס הכנסה", amount: 3180 },
      { label: "ביטוח לאומי", amount: 1020 },
      { label: "הפקדה לקופת גמל", amount: 980 },
    ],
    grossSalary: 24000,
    netSalary: 17820,
    downloadUrl: null,
  },
  "payslip-2025-02": {
    id: "payslip-2025-02",
    periodLabel: "פברואר 2025",
    periodDate: "2025-02-01",
    paymentDate: "2025-03-01",
    employerName: "חברת דוגמה בע\"מ",
    employeeName: "ישראל ישראלי",
    employeeId: "123456789",
    earnings: [
      { label: "משכורת בסיס", amount: 22500 },
      { label: "שעות נוספות", amount: 1500 },
    ],
    deductions: [
      { label: "מס הכנסה", amount: 3150 },
      { label: "ביטוח לאומי", amount: 1020 },
      { label: "הפקדה לקופת גמל", amount: 880 },
    ],
    grossSalary: 24000,
    netSalary: 18450,
    downloadUrl: null,
  },
};

const getMockDetail = (id: string): PayslipDetail | null => {
  if (MOCK_DETAILS[id]) return MOCK_DETAILS[id];
  return {
    id,
    periodLabel: "תלוש משכורת",
    periodDate: "",
    earnings: [],
    deductions: [],
    grossSalary: 0,
    netSalary: 0,
  };
};

export const fetchPayslipHistory = async () => {
  await delay(MOCK_DELAY_MS);
  return MOCK_RESPONSE;
};

export const fetchPayslipDetail = async (id: string): Promise<PayslipDetail | null> => {
  await delay(MOCK_DELAY_MS);
  return getMockDetail(id);
};
