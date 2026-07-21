# Navigation Migration — Orchestrator-Centric Advisory Flow

This document defines the target navigation and onboarding architecture for FinGuide’s financial advisory system. The **Orchestrator** (Hub / master intake surface) centralizes document uploads and routing; **each existing agent page** retains its own professional onboarding and recommendation experience.

Related code today:
- Hub / Orchestrator UI: `frontend/src/pages/HubPage.tsx`
- Agent routes: `frontend/src/types/navigation.ts` (`APP_ROUTES.pension`, `.gemel`, `.insurance`, payslip agent)
- Per-agent onboarding: `useAgentOnboarding`, `AgentOnboardingModal`, domain wizards (`PensionOnboardingWizard`, `InsuranceOnboardingWizard`, etc.)
- Shared profile: `User.onboarding`, `/api/profile`, smart onboarding APIs

---

## Target user journey

```text
Orchestrator (Hub)
  → document intake (Har HaKesef, Har HaBituach, payslips, Excel)
  → report parsing and routing to domain agents
  → user enters selected existing agent page
  → agent-specific onboarding (if incomplete)
  → recommendations / analysis
```

The Orchestrator **does not** replace agent onboarding or render agent recommendations directly.

---

## Agent-specific onboarding must remain

The Orchestrator owns **document intake and routing only**.

It must **not** replace the existing onboarding flow of each advisor.

After the Orchestrator routes the relevant report data, the user enters the selected existing agent and completes that agent’s professional onboarding.

Expected flow:

```text
Orchestrator document intake
→ report parsing and routing
→ enter existing agent
→ agent-specific onboarding
→ recommendations
```

---

## Shared profile vs agent-specific questions

Reuse existing shared user-profile data across agents where available.

Examples of shared fields:

```text
age
marital status
children
employment status
monthly salary
```

Do not ask the same shared question again when a reliable current answer already exists.

Each agent should ask only the **additional** questions required for its own analysis.

### Existing Pension Agent onboarding

Preserve pension-specific questions such as:

- retirement horizon
- expected retirement age
- risk tolerance
- salary relevant to pension deposits
- survivor-coverage needs
- expected future withdrawals
- pension goals

**Implementation reference:** `PensionOnboardingWizard`, `useAgentOnboarding("pension")`, pension smart-onboarding APIs.

### Existing Gemel Agent onboarding

Preserve gemel-specific questions such as:

- purpose of the money
- expected withdrawal date
- investment horizon
- liquidity needs
- risk tolerance
- whether the product is intended for retirement or a nearer goal

**Implementation reference:** `useAgentOnboarding("gemel")`, gemel onboarding question sets.

### Existing Insurance Agent onboarding

Preserve and extend the existing Insurance Agent onboarding for questions such as:

- financial dependents
- children
- income that needs protection
- vehicle ownership
- home ownership or rental
- employer-provided insurance
- known private insurance
- important coverage needs

The **same** existing Insurance Agent should use this onboarding for both:

```text
pension-related coverages from the clearinghouse report
+
private insurance data from Har HaBituach
```

Do **not** create separate onboarding flows for two insurance agents.

**Implementation reference:** `InsuranceOnboardingWizard`, `useAgentOnboarding("insurance")`, `insuranceOnboarding.api.ts`.

### Existing Payslip Agent onboarding

Leave the current Payslip Agent onboarding **unchanged**.

**Implementation reference:** `PayslipsAgentPage`, payslip / smart onboarding as implemented today.

---

## Onboarding status

Each agent page should distinguish between:

```text
document missing
document processing
document ready — onboarding incomplete
document ready — onboarding complete
analysis ready
```

When document data exists but agent onboarding is incomplete, route the user into that agent’s **existing onboarding** instead of showing an upload prompt.

---

## Agent readiness dashboard

The Orchestrator should become the **central dashboard** for the financial advisory system.

Besides document uploads, it should also display the **readiness state of every existing advisor**.

Example — document inventory:

```text
✔ Pension report uploaded
⚠ Har HaBituach missing
✔ Payslips uploaded
```

Example — advisor readiness:

```text
Advisor readiness

✔ Pension Agent
🟡 Gemel Agent — Onboarding required
🟡 Insurance Agent — Private insurance report recommended
✔ Payslip Agent — Ready
```

Readiness should reflect both **document availability** (routed from Orchestrator intake) and **agent onboarding completion** (per agent, not global).

---

## Completion condition

The migration is correct only when:

- the Orchestrator owns uploads
- each existing agent retains its own onboarding
- shared profile data is reused
- duplicate questions are avoided
- agent-specific questions remain inside the relevant agent
- recommendations are generated only after the required agent-specific onboarding is complete
- the Hub displays per-advisor readiness (documents + onboarding + analysis state)

---

## Out of scope for Orchestrator

| Orchestrator owns | Orchestrator must not own |
|-------------------|---------------------------|
| Document upload UX | Pension / gemel / insurance / payslip onboarding wizards |
| Parse + route report data to agents | Agent-specific recommendation UI (`ThreeCardSummary`, legacy panels) |
| Readiness dashboard | Replacing agent pages or merging onboarding into Hub |
| Deep-link / navigate to agent when action needed | Asking agent-specific questions at Hub level |
