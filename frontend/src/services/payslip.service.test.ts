import { fetchPayslipDetail, fetchPayslipHistory } from "./payslip.service";
import { getPayslip, listPayslips } from "../api/documents.api";

jest.mock("../api/documents.api", () => ({
  getPayslip: jest.fn(),
  listPayslips: jest.fn(),
}));

const mockedGetPayslip = getPayslip as jest.MockedFunction<typeof getPayslip>;
const mockedListPayslips = listPayslips as jest.MockedFunction<typeof listPayslips>;

describe("payslip.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns the canonical payslip history from the backend without OCR parsing in the client", async () => {
    mockedListPayslips.mockResolvedValue({
      success: true,
      data: {
        stats: {
          averageNet: 9000,
          averageGross: 12000,
          totalPayslips: 1,
        },
        items: [
          {
            id: "doc-1",
            periodLabel: "מרץ 2026",
            periodDate: "2026-03-01",
            grossSalary: 12000,
            netSalary: 9000,
            isLatest: true,
          },
        ],
      },
    });

    await expect(fetchPayslipHistory()).resolves.toEqual({
      stats: {
        averageNet: 9000,
        averageGross: 12000,
        totalPayslips: 1,
      },
      items: [
        expect.objectContaining({
          id: "doc-1",
          grossSalary: 12000,
          netSalary: 9000,
        }),
      ],
    });
  });

  it("returns the canonical payslip detail DTO from the backend", async () => {
    mockedGetPayslip.mockResolvedValue({
      success: true,
      data: {
        id: "doc-1",
        periodLabel: "מרץ 2026",
        periodDate: "2026-03-01",
        earnings: [],
        deductions: [],
        grossSalary: 12000,
        netSalary: 9000,
      },
    });

    await expect(fetchPayslipDetail("doc-1")).resolves.toEqual(
      expect.objectContaining({
        id: "doc-1",
        grossSalary: 12000,
        netSalary: 9000,
      })
    );
  });
});
