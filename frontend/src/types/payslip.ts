export type PayslipHistoryItem = {
  id: string;
  periodLabel: string;
  periodDate: string;
  netSalary: number;
  grossSalary: number;
  isLatest: boolean;
  downloadUrl?: string | null;
};

export type PayslipHistoryStats = {
  averageNet: number;
  averageGross: number;
  totalPayslips: number;
};

export type PayslipHistoryResponse = {
  stats: PayslipHistoryStats;
  items: PayslipHistoryItem[];
};
