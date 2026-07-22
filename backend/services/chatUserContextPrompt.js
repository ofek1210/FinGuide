/**
 * Shared helpers that append user financial context to LLM system-prompt line arrays.
 * Used by Claude (enhanced) and Ollama (financial) chat paths.
 */

const SALARY_COMPONENT_LABELS = {
  base_salary: 'שכר בסיס',
  global_overtime: 'שעות נוספות גלובליות',
  travel_expenses: 'דמי נסיעה',
  bonus: 'בונוס',
  holiday_pay: 'דמי חגים',
  overtime_125: 'שעות נוספות 125%',
  overtime_150: 'שעות נוספות 150%',
  convalescence: 'דמי הבראה',
  clothing_allowance: 'ביגוד',
};

/**
 * Append payslip + pension/insurance analysis + history blocks to `lines`.
 * @param {string[]} lines
 * @param {object|null|undefined} userContext
 * @param {{ headingStyle?: 'plain' | 'section' }} [options]
 */
function appendUserFinancialContext(lines, userContext, options = {}) {
  const section = (title) => {
    if (options.headingStyle === 'section') {
      lines.push('', `--- ${title} ---`);
    } else {
      lines.push('', `${title}:`);
    }
  };

  const hasPayslip =
    userContext?.grossSalary != null || userContext?.netSalary != null;

  if (hasPayslip) {
    section(options.headingStyle === 'section' ? 'תלוש שכר אחרון' : 'נתוני תלוש שכר אחרון של המשתמש');

    if (userContext.employeeName) lines.push(`שם העובד: ${userContext.employeeName}`);
    if (userContext.employerName) lines.push(`שם המעסיק: ${userContext.employerName}`);
    if (userContext.payslipDate) lines.push(`תאריך תלוש: ${userContext.payslipDate}`);
    if (userContext.jobPercentage != null) lines.push(`אחוז משרה: ${userContext.jobPercentage}%`);

    if (userContext.grossSalary != null) lines.push(`ברוטו: ${userContext.grossSalary} ₪`);
    if (userContext.baseSalary != null) lines.push(`שכר בסיס: ${userContext.baseSalary} ₪`);
    if (userContext.netSalary != null) lines.push(`נטו לתשלום: ${userContext.netSalary} ₪`);

    if (Array.isArray(userContext.salaryComponents) && userContext.salaryComponents.length > 0) {
      lines.push('רכיבי שכר:');
      userContext.salaryComponents.slice(0, 12).forEach((c) => {
        const label = SALARY_COMPONENT_LABELS[c.type] || c.type;
        if (c.amount != null) lines.push(`  ${label}: ${c.amount} ₪`);
      });
    }

    if (
      userContext.tax != null ||
      userContext.nationalInsurance != null ||
      userContext.healthInsurance != null
    ) {
      lines.push('ניכויי חובה:');
      if (userContext.tax != null) lines.push(`  מס הכנסה: ${userContext.tax} ₪`);
      if (userContext.nationalInsurance != null) {
        lines.push(`  ביטוח לאומי: ${userContext.nationalInsurance} ₪`);
      }
      if (userContext.healthInsurance != null) {
        lines.push(`  מס בריאות: ${userContext.healthInsurance} ₪`);
      }
      if (userContext.mandatoryDeductionsTotal != null) {
        lines.push(`  סה"כ ניכויי חובה: ${userContext.mandatoryDeductionsTotal} ₪`);
      }
    }

    const hasPension =
      userContext.pensionEmployee != null || userContext.pensionEmployer != null;
    const hasFund =
      userContext.trainingFundEmployee != null ||
      userContext.trainingFundEmployer != null;
    if (hasPension || hasFund) {
      lines.push('הפרשות פנסיוניות:');
      if (userContext.pensionEmployee != null) {
        lines.push(`  פנסיה עובד: ${userContext.pensionEmployee} ₪`);
      }
      if (userContext.pensionEmployer != null) {
        lines.push(`  פנסיה מעסיק: ${userContext.pensionEmployer} ₪`);
      }
      if (userContext.pensionSeverance != null) {
        lines.push(`  פיצויים (מעסיק): ${userContext.pensionSeverance} ₪`);
      }
      if (userContext.trainingFundEmployee != null) {
        const pct =
          userContext.trainingFundEmployeePercent != null
            ? ` (${userContext.trainingFundEmployeePercent}%)`
            : '';
        lines.push(
          `  קרן השתלמות עובד: ${userContext.trainingFundEmployee} ₪${pct}`,
        );
      }
      if (userContext.trainingFundEmployer != null) {
        const pct =
          userContext.trainingFundEmployerPercent != null
            ? ` (${userContext.trainingFundEmployerPercent}%)`
            : '';
        lines.push(
          `  קרן השתלמות מעסיק: ${userContext.trainingFundEmployer} ₪${pct}`,
        );
      }
    }

    if (userContext.marginalTaxRate != null || userContext.taxCreditPoints != null) {
      lines.push('מידע מס:');
      if (userContext.marginalTaxRate != null) {
        lines.push(`  שיעור מס שולי: ${userContext.marginalTaxRate}%`);
      }
      if (userContext.taxCreditPoints != null) {
        lines.push(`  נקודות זיכוי: ${userContext.taxCreditPoints}`);
      }
    }

    if (
      userContext.workingDays != null ||
      userContext.vacationDays != null ||
      userContext.sickDays != null
    ) {
      lines.push('נתוני עבודה וחופשה:');
      if (userContext.workingDays != null) {
        lines.push(`  ימי עבודה בחודש: ${userContext.workingDays}`);
      }
      if (userContext.workingHours != null) {
        lines.push(`  שעות עבודה בחודש: ${userContext.workingHours}`);
      }
      if (userContext.vacationDays != null) {
        lines.push(`  יתרת ימי חופשה: ${userContext.vacationDays}`);
      }
      if (userContext.sickDays != null) {
        lines.push(`  יתרת ימי מחלה: ${userContext.sickDays}`);
      }
    }
  } else if (userContext) {
    lines.push('', 'אין עדיין נתוני תלוש שכר מנותחים עבור המשתמש.');
  }

  if (userContext?.documents?.length) {
    lines.push(`סה"כ מסמכים במערכת: ${userContext.documents.length}`);
  }

  if (Array.isArray(userContext?.payslipHistory) && userContext.payslipHistory.length > 0) {
    section(
      options.headingStyle === 'section'
        ? 'תלושים קודמים (מגמות)'
        : 'תלושים קודמים (לבדיקת מגמות)',
    );
    userContext.payslipHistory.slice(0, 3).forEach((p) => {
      const label = p.date || 'תלוש קודם';
      const parts = [];
      if (p.grossSalary != null) parts.push(`ברוטו: ${p.grossSalary} ₪`);
      if (p.netSalary != null) parts.push(`נטו: ${p.netSalary} ₪`);
      if (p.tax != null) parts.push(`מס: ${p.tax} ₪`);
      if (p.pensionEmployee != null) parts.push(`פנסיה עובד: ${p.pensionEmployee} ₪`);
      if (parts.length > 0) lines.push(`  ${label}: ${parts.join(' | ')}`);
    });
  }

  const pension = userContext?.pensionAnalysis;
  if (pension?.hasData) {
    section(
      options.headingStyle === 'section' ? 'ניתוח פנסיה מיובא' : 'ניתוח פנסיה מיובא',
    );
    if (pension.healthScore != null) {
      lines.push(`ציון בריאות פנסיונית: ${pension.healthScore}/100`);
    }
    if (pension.fundCount != null) lines.push(`מספר קרנות: ${pension.fundCount}`);
    if (pension.recommendedRiskLevel) {
      lines.push(`רמת סיכון מומלצת: ${pension.recommendedRiskLevel}`);
    }
    if (pension.totalPotentialSavings > 0) {
      lines.push(
        `חיסכון פוטנציאלי עד פרישה: ₪${Math.round(pension.totalPotentialSavings).toLocaleString('he-IL')}`,
      );
    }
    if (Array.isArray(pension.topRecs) && pension.topRecs.length) {
      lines.push(`המלצות פנסיה: ${pension.topRecs.join(', ')}`);
    }
  }

  const insurance = userContext?.insuranceAnalysis;
  if (insurance?.hasData) {
    section(
      options.headingStyle === 'section' ? 'ניתוח ביטוח מיובא' : 'ניתוח ביטוח מיובא',
    );
    if (insurance.healthScore != null) {
      lines.push(`ציון בריאות ביטוח: ${insurance.healthScore}/100`);
    }
    if (insurance.duplicateCount > 0) {
      lines.push(`כפילויות ביטוח: ${insurance.duplicateCount}`);
    }
    if (insurance.totalMonthlyWaste > 0) {
      lines.push(
        `בזבוז חודשי משוער: ₪${Math.round(insurance.totalMonthlyWaste).toLocaleString('he-IL')}`,
      );
    }
    if (Array.isArray(insurance.topRecs) && insurance.topRecs.length) {
      lines.push(`המלצות ביטוח: ${insurance.topRecs.join(', ')}`);
    }
  }

  const findings = Array.isArray(userContext?.findings) ? userContext.findings : [];
  if (findings.length) {
    section(
      options.headingStyle === 'section' ? 'ממצאים פעילים מהמערכת' : 'ממצאים פעילים מהמערכת',
    );
    findings.slice(0, 5).forEach((f) => {
      lines.push(`- [${f.severity === 'warning' ? 'אזהרה' : 'מידע'}] ${f.title}: ${f.details || ''}`);
    });
  }

  return lines;
}

module.exports = { appendUserFinancialContext };
