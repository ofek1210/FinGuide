import { buildMoneyFlow, enrichPayslipFromAnalysis } from "./payslipEnrichment";

describe("buildMoneyFlow", () => {
  it("shows average gross/net at top and cumulative totals for line items", () => {
    const first = enrichPayslipFromAnalysis({
      salary: { gross_total: 10000, net_payable: 7000 },
      summary: { grossSalary: 10000, netSalary: 7000, tax: 1000 },
      deductions: { mandatory: { income_tax: 1000 } },
    });
    const second = enrichPayslipFromAnalysis({
      salary: { gross_total: 12000, net_payable: 8400 },
      summary: { grossSalary: 12000, netSalary: 8400, tax: 1200 },
      deductions: { mandatory: { income_tax: 1200 } },
    });

    const flow = buildMoneyFlow([first, second]);
    expect(flow).not.toBeNull();
    expect(flow!.avgGross).toBe(11000);
    expect(flow!.avgNet).toBe(7700);
    expect(flow!.totalGross).toBe(22000);
    expect(flow!.totalWithheld).toBe(6600);

    const taxItem = flow!.items.find(i => i.label === "מס הכנסה");
    expect(taxItem?.totalAmount).toBe(2200);
    expect(taxItem?.pctOfGross).toBe(10);
  });
});
