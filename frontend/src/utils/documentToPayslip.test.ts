import {
  documentToPayslipDetail,
  documentToPayslipItem,
  getPayslipHistoryFromIntelligence,
} from "./documentToPayslip";

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

  it("maps yearly intelligence payload into history response", () => {
    const response = getPayslipHistoryFromIntelligence({
      years: [
        {
          year: 2026,
          monthsPresent: [1, 3],
          missingMonths: [2, 4, 5, 6, 7, 8, 9, 10, 11, 12],
          monthsMissingCount: 10,
          coveragePercent: 17,
          grossAverage: 21000,
          netAverage: 14750,
          grossTotal: 42000,
          netTotal: 29500,
          taxPaidTotal: 5400,
          nationalInsuranceTotal: 1000,
          healthInsuranceTotal: 400,
          taxCreditPointsAverage: 2.25,
        },
      ],
      selectedYear: 2026,
      selectedYearStats: {
        year: 2026,
        monthsPresent: [1, 3],
        missingMonths: [2, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        monthsMissingCount: 10,
        coveragePercent: 17,
        grossAverage: 21000,
        netAverage: 14750,
        grossTotal: 42000,
        netTotal: 29500,
        taxPaidTotal: 5400,
        nationalInsuranceTotal: 1000,
        healthInsuranceTotal: 400,
        taxCreditPointsAverage: 2.25,
      },
      items: [
        {
          id: "doc-jan",
          periodMonth: "2026-01",
          periodYear: 2026,
          periodMonthNumber: 1,
          grossSalary: 20000,
          netSalary: 14000,
          uploadedAt: "2026-01-25T10:00:00.000Z",
          isLatest: false,
        },
      ],
      missingMonthsByYear: [{ year: 2026, missingMonths: [2] }],
      incompletePeriods: [],
      taxAdjustment: {
        year: 2026,
        status: "partial",
        expectedAnnualTax: 32000,
        actualTaxWithheld: 35000,
        estimatedRefundOrDue: 3000,
        confidence: 0.7,
        assumptions: ["partial year"],
      },
      dataQualityWarnings: ["Year 2026 is missing 10 month(s)."],
    } as any);

    expect(response.selectedYear).toBe(2026);
    expect(response.stats.averageGross).toBe(21000);
    expect(response.stats.missingMonths).toContain(2);
    expect(response.taxAdjustment?.status).toBe("partial");
    expect(response.items[0]?.periodLabel).toBeTruthy();
  });
});
