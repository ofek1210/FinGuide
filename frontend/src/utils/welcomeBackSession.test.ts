import {
  clearWelcomeBackPending,
  isWelcomeBackPending,
  markWelcomeBackPending,
} from "./welcomeBackSession";

describe("welcomeBackSession", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("starts with no pending welcome-back flag", () => {
    expect(isWelcomeBackPending()).toBe(false);
  });

  it("marks and clears the welcome-back flag", () => {
    markWelcomeBackPending();
    expect(isWelcomeBackPending()).toBe(true);

    clearWelcomeBackPending();
    expect(isWelcomeBackPending()).toBe(false);
  });
});
