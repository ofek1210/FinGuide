const {
  collectContributionCandidates,
  resolveContributionCandidates,
} = require('../../services/payslipOcrContributions');

describe('payslipOcrContributions explicit deduction labels', () => {
  it('reads ניכוי לקרן פנסיה and ניכוי לקרן השתלמות as employee deductions', () => {
    const lines = [
      'שכר ברוטו 18,000',
      'ניכוי לקרן פנסיה 1,080',
      'ניכוי לקרן השתלמות 360',
      'הפרשת מעסיק לקרן פנסיה 1,170',
      'הפרשת מעסיק לקרן השתלמות 1,350',
    ];

    const warnings = [];
    const collected = collectContributionCandidates(lines);
    const resolved = resolveContributionCandidates(collected.store, collected.stats, warnings);

    expect(resolved.pension.employee).toBe(1080);
    expect(resolved.pension.employer).toBe(1170);
    expect(resolved.study.employee).toBe(360);
    expect(resolved.study.employer).toBe(1350);
  });

  it('reads ניכוי עובד פנסיה with rate and amount', () => {
    const lines = [
      'שכר לקצבה 10,000',
      'ניכוי עובד פנסיה 7% 1,500',
      'הפרשת מעסיק פנסיה 7.5% 2,000',
    ];

    const warnings = [];
    const collected = collectContributionCandidates(lines);
    const resolved = resolveContributionCandidates(collected.store, collected.stats, warnings);

    expect(resolved.pension.employee).toBe(1500);
    expect(resolved.pension.employer).toBe(2000);
  });

  it('reads IDF underscore labels: השתתפות is employer share, total is employee + employer', () => {
    const lines = [
      'ניכוי_לקרן_פנסיה 750.00',
      'השתתפות_בקרן_פנסיה 1,875.00',
      'ניכוי_לקרן_השתלמות 250.00',
      'השתתפות_בקרן_השתלמות 500.00',
    ];

    const warnings = [];
    const collected = collectContributionCandidates(lines);
    const resolved = resolveContributionCandidates(collected.store, collected.stats, warnings);

    expect(resolved.pension.employee).toBe(750);
    expect(resolved.pension.employer).toBe(1875);
    expect(resolved.pension.participation_total).toBe(2625);
    expect(resolved.study.employee).toBe(250);
    expect(resolved.study.employer).toBe(500);
    expect(resolved.study.participation_total).toBe(750);
    expect(warnings).toEqual([]);
  });

  it('reads ניכוי עובד לקרן השתלמות (standard format)', () => {
    const lines = [
      'ניכוי עובד לקרן השתלמות 360',
      'הפרשת מעסיק לקרן השתלמות 1,350',
    ];

    const warnings = [];
    const collected = collectContributionCandidates(lines);
    const resolved = resolveContributionCandidates(collected.store, collected.stats, warnings);

    expect(resolved.study.employee).toBe(360);
    expect(resolved.study.employer).toBe(1350);
  });

  it('supports standard Michpal-style and IDF labels in parallel', () => {
    const standard = collectContributionCandidates([
      'ניכוי לקרן פנסיה 1,080',
      'הפרשת מעסיק לקרן פנסיה 1,170',
    ]);
    const idf = collectContributionCandidates([
      'ניכוי_לקרן_הפנסיה 750.00',
      'השתתפות_בקרן_הפנסיה 1,875.00',
    ]);

    const stdResolved = resolveContributionCandidates(standard.store, standard.stats, []);
    const idfResolved = resolveContributionCandidates(idf.store, idf.stats, []);

    expect(stdResolved.pension.employee).toBe(1080);
    expect(stdResolved.pension.employer).toBe(1170);
    expect(idfResolved.pension.employee).toBe(750);
    expect(idfResolved.pension.employer).toBe(1875);
    expect(idfResolved.pension.participation_total).toBe(2625);
  });

  it('reads IDF labels with הפנסיה, ההשתלמו and double underscore', () => {
    const lines = [
      'ניכוי_לקרן_הפנסיה 750.00',
      'השתתפות_בקרן_הפנסיה 1,875.00',
      'ניכוי_לקרן__השתלמות 250.00',
      'השתתפות_בקרן_ההשתלמו 500.00',
    ];

    const warnings = [];
    const collected = collectContributionCandidates(lines);
    const resolved = resolveContributionCandidates(collected.store, collected.stats, warnings);

    expect(resolved.pension.employee).toBe(750);
    expect(resolved.pension.employer).toBe(1875);
    expect(resolved.pension.participation_total).toBe(2625);
    expect(resolved.study.employee).toBe(250);
    expect(resolved.study.employer).toBe(500);
    expect(resolved.study.participation_total).toBe(750);
    expect(warnings).toEqual([]);
  });

  it('reads IDF study fund when OCR drops yod (נכוי) or splits label and amount', () => {
    const ocrTypo = collectContributionCandidates([
      'נכוי_לקרן__השתלמות 250.00',
      'השתתפות_בקרן_ההשתלמו 500.00',
    ]);
    const splitLines = collectContributionCandidates([
      'נכוי_לקרן__השתלמות',
      '250.00',
      'השתתפות_בקרן_ההשתלמו',
      '500.00',
    ]);

    const typoResolved = resolveContributionCandidates(ocrTypo.store, ocrTypo.stats, []);
    const splitResolved = resolveContributionCandidates(splitLines.store, splitLines.stats, []);

    expect(typoResolved.study.employee).toBe(250);
    expect(typoResolved.study.employer).toBe(500);
    expect(typoResolved.study.participation_total).toBe(750);
    expect(splitResolved.study.employee).toBe(250);
    expect(splitResolved.study.employer).toBe(500);
    expect(splitResolved.study.participation_total).toBe(750);
  });

  it('reads June 2026 IDF payslip: employee deduction vs employer participation', () => {
    const lines = [
      'ניכוי_לקרן_הפנסיה 2112.62',
      'השתתפות_בקרן_הפנסיה 3176.41',
      'ניכוי_לקרן__השתלמות 743.61',
      'השתתפות_בקרן_ההשתלמו 1744.17',
    ];

    const warnings = [];
    const collected = collectContributionCandidates(lines);
    const resolved = resolveContributionCandidates(collected.store, collected.stats, warnings);

    expect(resolved.pension.employee).toBe(2112.62);
    expect(resolved.pension.employer).toBe(3176.41);
    expect(resolved.pension.participation_total).toBe(5289.03);
    expect(resolved.study.employee).toBe(743.61);
    expect(resolved.study.employer).toBe(1744.17);
    expect(resolved.study.participation_total).toBe(2487.78);
    expect(warnings).toEqual([]);
  });

  it('reads glued pay-period suffix on participation lines without treating 26 as employer', () => {
    const lines = [
      'צבא הגנה לישראל',
      'ניכוי_לקרן_הפנסיה 1647.03',
      'השתתפות בקרן הפנסיה 3,176.4101.06.26',
      'ניכוי_לקרן__השתלמות 581.39',
      'השתתפות_בקרן_ההשתלמו 1744.1701.06.26',
    ];

    const warnings = [];
    const collected = collectContributionCandidates(lines);
    const resolved = resolveContributionCandidates(collected.store, collected.stats, warnings);

    expect(resolved.pension.employee).toBe(1647.03);
    expect(resolved.pension.employer).toBe(3176.41);
    expect(resolved.study.employee).toBe(581.39);
    expect(resolved.study.employer).toBe(1744.17);
    expect(warnings).toEqual([]);
  });

  it('reads study employee from OCR table row with pipe separator and merged prior/current amounts', () => {
    const lines = [
      'צבא הגנה לישראל',
      'תוספת פעילות 3637.60 ניכוי לקרן פנסיה 2112.621647.03',
      'השתתפות בקרן הפנסיה 3,176.4101.06.26',
      'תוספת צבא הקבע 6508.23 נכוי לקרן | השתלמות 743.61581.39',
      'השתתפות בקרן ההשתלמו 1,744.1701.06.26',
    ];

    const warnings = [];
    const collected = collectContributionCandidates(lines);
    const resolved = resolveContributionCandidates(collected.store, collected.stats, warnings);

    expect(resolved.pension.employee).toBe(1647.03);
    expect(resolved.study.employee).toBe(581.39);
    expect(resolved.study.employer).toBe(1744.17);
    expect(warnings).toEqual([]);
  });
});
