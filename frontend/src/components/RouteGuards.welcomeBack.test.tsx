import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { PreviewAuthProvider } from "../auth/AuthProvider";
import { APP_ROUTES } from "../types/navigation";
import { markWelcomeBackPending } from "../utils/welcomeBackSession";
import { RequireAuth } from "./RouteGuards";

/**
 * The welcome-back redirect used to fire regardless of the two first-run gates
 * that run before it. Those gates allow /welcome and /onboarding but not
 * /welcome-back, so a pending flag combined with welcomeShown === false (or
 * unfinished onboarding) bounced the user between the two routes until React
 * bailed out with "Maximum update depth exceeded" and nothing rendered.
 */
const guarded = (initialPath: string) => (
  <MemoryRouter initialEntries={[initialPath]}>
    <Routes>
      <Route path={APP_ROUTES.hub} element={<RequireAuth><div>HUB</div></RequireAuth>} />
      <Route path={APP_ROUTES.welcome} element={<RequireAuth><div>WELCOME</div></RequireAuth>} />
      <Route path={APP_ROUTES.welcomeBack} element={<RequireAuth><div>WELCOME_BACK</div></RequireAuth>} />
      <Route path={APP_ROUTES.onboarding} element={<RequireAuth><div>ONBOARDING</div></RequireAuth>} />
    </Routes>
  </MemoryRouter>
);

const user = (over: Partial<{ welcomeShown: boolean; onboardingCompleted: boolean }>) => ({
  id: "u1",
  name: "נועה כהן",
  email: "noa@finguide.dev",
  welcomeShown: false,
  onboardingCompleted: false,
  ...over,
});

describe("RequireAuth — welcome-back gating", () => {
  beforeEach(() => sessionStorage.clear());

  it("sends a returning user to /welcome-back", () => {
    markWelcomeBackPending();
    render(
      <PreviewAuthProvider user={user({ welcomeShown: true, onboardingCompleted: true })}>
        {guarded(APP_ROUTES.hub)}
      </PreviewAuthProvider>,
    );
    expect(screen.getByText("WELCOME_BACK")).toBeInTheDocument();
  });

  it("lets the new-user welcome win when the welcome screen has not been shown", () => {
    markWelcomeBackPending();
    render(
      <PreviewAuthProvider user={user({ welcomeShown: false, onboardingCompleted: true })}>
        {guarded(APP_ROUTES.welcomeBack)}
      </PreviewAuthProvider>,
    );
    expect(screen.getByText("WELCOME")).toBeInTheDocument();
  });

  it("lets onboarding win when it is unfinished", () => {
    markWelcomeBackPending();
    render(
      <PreviewAuthProvider user={user({ welcomeShown: true, onboardingCompleted: false })}>
        {guarded(APP_ROUTES.welcomeBack)}
      </PreviewAuthProvider>,
    );
    expect(screen.getByText("ONBOARDING")).toBeInTheDocument();
  });

  it("leaves the hub alone once the flag is cleared", () => {
    render(
      <PreviewAuthProvider user={user({ welcomeShown: true, onboardingCompleted: true })}>
        {guarded(APP_ROUTES.hub)}
      </PreviewAuthProvider>,
    );
    expect(screen.getByText("HUB")).toBeInTheDocument();
  });
});
