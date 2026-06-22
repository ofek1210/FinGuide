jest.mock("../api/documents.api", () => ({
  uploadDocument: jest.fn(),
  unlockDocument: jest.fn(),
}));

import type { DocumentItem } from "../api/documents.api";
import {
  MAX_PAYSLIPS,
  uploadFailureMessage,
  isAnalyzableUpload,
} from "./usePayslipUpload";

function doc(overrides: Partial<DocumentItem>): DocumentItem {
  return {
    _id: "x",
    originalName: "a.pdf",
    fileSize: 1,
    status: "completed",
    metadata: { category: "payslip" },
    analysisData: { summary: { grossSalary: 10000 } },
    ...overrides,
  };
}

describe("usePayslipUpload", () => {
  it("exports MAX_PAYSLIPS as 3", () => {
    expect(MAX_PAYSLIPS).toBe(3);
  });

  it("isAnalyzableUpload respects analyzable flag from API", () => {
    expect(isAnalyzableUpload(doc({ analyzable: true, status: "failed" }))).toBe(true);
    expect(isAnalyzableUpload(doc({ analyzable: false, status: "completed" }))).toBe(false);
  });

  it("uploadFailureMessage covers password and failed states", () => {
    expect(uploadFailureMessage(doc({ status: "needs_password" }), "f.pdf")).toContain("סיסמה");
    expect(uploadFailureMessage(doc({ status: "failed", processingError: "OCR" }), "f.pdf")).toContain("OCR");
  });
});
