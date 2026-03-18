export const APP_ROUTES = {
  home: "/",
  login: "/login",
  register: "/register",
  resetPassword: "/reset-password",
  onboarding: "/onboarding",
  dashboard: "/dashboard",
  documents: "/documents",
  documentsScan: "/documents/scan",
  documentsScanComplete: "/documents/scan/complete",
  payslipHistory: "/documents/history",
  findings: "/findings",
  assistant: "/assistant",
  settings: "/settings",
  integrationsEmail: "/integrations/email",
  status: "/status",
  help: "/help",
  error400: "/400",
  error401: "/401",
  error403: "/403",
  error500: "/500",
} as const;

export type AppRoute = (typeof APP_ROUTES)[keyof typeof APP_ROUTES];

export const PRIVATE_ROUTES: AppRoute[] = [
  APP_ROUTES.onboarding,
  APP_ROUTES.dashboard,
  APP_ROUTES.documents,
  APP_ROUTES.payslipHistory,
  APP_ROUTES.findings,
  APP_ROUTES.assistant,
  APP_ROUTES.settings,
  APP_ROUTES.integrationsEmail,
  APP_ROUTES.status,
  APP_ROUTES.help,
];
