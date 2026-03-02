import type { PayslipHistoryResponse } from "../types/payslip";

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

export const fetchPayslipHistory = async () => {
  await delay(MOCK_DELAY_MS);
  return MOCK_RESPONSE;
};
