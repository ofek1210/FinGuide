import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { markWelcomeShown } from "../api/auth.api";
import { PreviewAuthProvider } from "../auth/AuthProvider";
import WelcomePage from "./WelcomePage";

jest.mock("../api/auth.api", () => ({ markWelcomeShown: jest.fn() }));

const mockedMarkWelcomeShown = markWelcomeShown as jest.MockedFunction<typeof markWelcomeShown>;

function renderWelcome() {
  return render(
    <MemoryRouter initialEntries={["/welcome"]}>
      <PreviewAuthProvider user={{
        id: "new-user",
        name: "Dana Cohen",
        email: "dana@example.com",
        welcomeShown: false,
        onboardingCompleted: false,
      }}>
        <Routes>
          <Route path="/welcome" element={<WelcomePage />} />
          <Route path="/onboarding" element={<div>onboarding destination</div>} />
          <Route path="/hub" element={<div>hub destination</div>} />
        </Routes>
      </PreviewAuthProvider>
    </MemoryRouter>,
  );
}

describe("WelcomePage first-run flow", () => {
  beforeEach(() => {
    mockedMarkWelcomeShown.mockReset();
  });

  it("continues a new user to onboarding after persisting completion", async () => {
    mockedMarkWelcomeShown.mockResolvedValue({
      success: true,
      data: { user: {
        id: "new-user",
        name: "Dana Cohen",
        email: "dana@example.com",
        welcomeShown: true,
        onboardingCompleted: false,
      } },
    });

    renderWelcome();
    expect(screen.getAllByText("Dana", { exact: false }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /המשך ל-FinGuide/ }));

    expect(await screen.findByText("onboarding destination")).toBeTruthy();
    expect(mockedMarkWelcomeShown).toHaveBeenCalledTimes(1);
  });

  it("stays on welcome when completion cannot be persisted", async () => {
    mockedMarkWelcomeShown.mockResolvedValue({
      success: false,
      message: "לא הצלחנו לשמור את מצב הברכה.",
    });

    renderWelcome();
    fireEvent.click(screen.getByRole("button", { name: /המשך ל-FinGuide/ }));

    expect((await screen.findByRole("alert")).textContent).toContain("לא הצלחנו לשמור");
    expect(screen.queryByText("hub destination")).toBeNull();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /המשך ל-FinGuide/ }).hasAttribute("disabled")).toBe(false);
    });
  });
});
