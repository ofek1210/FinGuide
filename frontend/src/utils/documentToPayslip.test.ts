import { documentToPayslipDetail, documentToPayslipItem } from "./documentToPayslip";

describe("documentToPayslip", () => {
  it("does not auto-swap gross and net salaries in UI mapping", () => {
    const document = {
      _id: "doc-1",
      status: "completed",
      uploadedAt: "2026-04-12T00:00:00.000Z",
      analysisData: {
        period: { month: "2026-04" },
        salary: {
          gross_total: 10000,
          net_payable: 12000,
        },
        deductions: {
          mandatory: {},
        },
        contributions: {
          pension: {},
          study_fund: {},
        },
        parties: {},
        summary: {},
      },
    } as any;

    expect(documentToPayslipItem(document, 0)).toEqual(
      expect.objectContaining({
        grossSalary: 10000,
        netSalary: 12000,
      }),
    );

    expect(documentToPayslipDetail(document)).toEqual(
      expect.objectContaining({
        grossSalary: 10000,
        netSalary: 12000,
      }),
    );
  });
});
