import { detectPayslipMetadataFromFilename } from "./detectPayslipMetadataFromFilename";

describe("detectPayslipMetadataFromFilename", () => {
  it("parses Hebrew month filenames like ינואר 2025.pdf", () => {
    const file = { name: "ינואר 2025.pdf" } as File;
    expect(detectPayslipMetadataFromFilename(file)).toEqual({
      category: "payslip",
      periodMonth: 1,
      periodYear: 2025,
    });
  });

  it("parses paycheck-05-2025-2.pdf as May 2025", () => {
    const file = { name: "paycheck-05-2025-2.pdf" } as File;
    expect(detectPayslipMetadataFromFilename(file)).toEqual({
      category: "payslip",
      periodMonth: 5,
      periodYear: 2025,
    });
  });
});
