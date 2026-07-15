import type { DocumentItem } from "../api/documents.api";
import {
  buildAnalysisSummary,
  selectRecentPayslipDocuments,
  isAnalyzablePayslip,
} from "./payslipAnalysisSummary";

function makePayslipDoc(
  id: string,
  periodMonth: string,
  uploadedAt: string,
  overrides: Partial<DocumentItem> = {},
): DocumentItem {
  return {
    _id: id,
    originalName: `${periodMonth}.pdf`,
    fileSize: 1000,
    status: "completed",
    uploadedAt,
    metadata: { category: "payslip" },
    analysisData: {
      period: { month: periodMonth },
      salary: { gross_total: 10000, net_payable: 7000 },
      summary: { grossSalary: 10000, netSalary: 7000 },
    },
    ...overrides,
  };
}

describe("selectRecentPayslipDocuments", () => {
  it("picks 3 most recent payslips by salary period, not upload order", () => {
    const docs = [
      makePayslipDoc("m", "2025-03", "2025-04-01T10:00:00Z"),
      makePayslipDoc("j", "2025-01", "2025-04-03T10:00:00Z"),
      makePayslipDoc("f", "2025-02", "2025-04-02T10:00:00Z"),
      makePayslipDoc("old", "2024-11", "2025-05-01T10:00:00Z"),
    ];

    const recent = selectRecentPayslipDocuments(docs, 3);
    expect(recent.map(d => d._id)).toEqual(["m", "f", "j"]);
  });

  it("dedupes same month and keeps latest upload", () => {
    const docs = [
      makePayslipDoc("old-jan", "2025-01", "2025-02-01T10:00:00Z"),
      makePayslipDoc("new-jan", "2025-01", "2025-03-01T10:00:00Z"),
      makePayslipDoc("feb", "2025-02", "2025-03-02T10:00:00Z"),
    ];

    const recent = selectRecentPayslipDocuments(docs, 3);
    expect(recent.map(d => d._id)).toEqual(["feb", "new-jan"]);
  });

  it("returns all payslips when limit is 0", () => {
    const docs = [
      makePayslipDoc("m", "2025-03", "2025-04-01T10:00:00Z"),
      makePayslipDoc("j", "2025-01", "2025-04-03T10:00:00Z"),
      makePayslipDoc("f", "2025-02", "2025-04-02T10:00:00Z"),
      makePayslipDoc("old", "2024-11", "2025-05-01T10:00:00Z"),
    ];

    const recent = selectRecentPayslipDocuments(docs, 0);
    expect(recent).toHaveLength(4);
  });

  it("excludes failed documents from analysis", () => {
    const docs = [
      makePayslipDoc("ok", "2025-01", "2025-02-01T10:00:00Z"),
      makePayslipDoc("bad", "2025-02", "2025-03-01T10:00:00Z", { status: "failed" }),
    ];

    expect(isAnalyzablePayslip(docs[1]!)).toBe(false);
    const summary = buildAnalysisSummary(docs, 3);
    expect(summary.count).toBe(1);
    expect(summary.rows[0]?.id).toBe("ok");
  });
});
