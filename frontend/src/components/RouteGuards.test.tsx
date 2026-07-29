import { describe, expect, it, jest } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { RequireAuth } from "./RouteGuards";

jest.mock("../auth/AuthProvider", () => ({ useAuth: jest.fn() }));

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

function renderProtected() {
  return render(
    <MemoryRouter initialEntries={["/hub"]}>
      <Routes>
        <Route path="/hub" element={<RequireAuth><div>protected hub</div></RequireAuth>} />
        <Route path="/welcome" element={<RequireAuth><div>welcome destination</div></RequireAuth>} />
        <Route path="/onboarding" element={<div>onboarding destination</div>} />
        <Route path="/login" element={<div>login destination</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RequireAuth first-run routing", () => {
  it("redirects a new authenticated user to welcome", async () => {
    mockedUseAuth.mockReturnValue({
      status: "authenticated",
      user: {
        id: "new-user",
        name: "New User",
        email: "new@example.com",
        welcomeShown: false,
        onboardingCompleted: false,
      },
      error: "",
      refresh: jest.fn(async () => true),
    });

    renderProtected();
    expect(await screen.findByText("welcome destination")).toBeTruthy();
  });

  it("does not show welcome again after it was completed", async () => {
    mockedUseAuth.mockReturnValue({
      status: "authenticated",
      user: {
        id: "returning-user",
        name: "Returning User",
        email: "returning@example.com",
        welcomeShown: true,
        onboardingCompleted: true,
      },
      error: "",
      refresh: jest.fn(async () => true),
    });

    renderProtected();
    expect(await screen.findByText("protected hub")).toBeTruthy();
    expect(screen.queryByText("welcome destination")).toBeNull();
  });
});
