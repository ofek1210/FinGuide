/**
 * One-shot "Welcome Back" trigger scoped to the current browser session.
 *
 * Lives in sessionStorage so it survives refresh inside the same tab but
 * never bleeds across logins or new tabs. The new-user welcome flow
 * (WelcomePage) clears it so a freshly-registered user never sees both
 * screens back-to-back.
 */
const KEY = "finguide.welcomeBack.pending";

const storage = (): Storage | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

export function markWelcomeBackPending(): void {
  storage()?.setItem(KEY, "1");
}

export function isWelcomeBackPending(): boolean {
  return storage()?.getItem(KEY) === "1";
}

export function clearWelcomeBackPending(): void {
  storage()?.removeItem(KEY);
}
