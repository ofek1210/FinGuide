jest.mock("./client", () => ({
  apiJson: jest.fn(() => Promise.resolve({ ok: true, status: 200, data: { success: true, data: {} } })),
}));

import { apiJson } from "./client";
import { submitInsuranceOnboardingAnswer } from "./insuranceOnboarding.api";

describe("insurance onboarding API", () => {
  it("passes answer payload as an object so apiJson serializes it once", async () => {
    const body = { questionId: "home.rents", value: false, skipped: false };

    await submitInsuranceOnboardingAnswer(body);

    expect(apiJson).toHaveBeenCalledWith("/api/insurance/onboarding/answer", {
      method: "POST",
      auth: true,
      body,
    });
  });
});
