const UserProfile = require('../models/UserProfile');
const Document = require('../models/Document');
const Insight = require('../models/Insight');
const { buildInvestmentRecommendations } = require('../services/investmentRecommenderService');
const { analyzeBudget } = require('../services/budgetAnalysisService');
const { generateMonthlyReport } = require('../services/monthlyReportService');
const { buildFinancialHealthScore } = require('../services/financialHealthScoreService');

// ── helpers ───────────────────────────────────────────────────────────────────

async function getLatestPayslipSummary(userId) {
  const doc = await Document.findOne({
    user: userId,
    status: 'completed',
    $or: [
      { 'metadata.category': 'payslip' },
      { 'analysisData.summary.grossSalary': { $exists: true, $ne: null } },
    ],
  }).sort({ uploadedAt: -1 }).lean();

  if (!doc?.analysisData?.summary) return null;
  const s = doc.analysisData.summary;
  return {
    grossSalary: s.grossSalary ?? null,
    netSalary: s.netSalary ?? null,
    pensionEmployee: s.pensionEmployee ?? null,
    tax: s.tax ?? null,
    nationalInsurance: s.nationalInsurance ?? null,
  };
}

// ── GET /api/copilot/analysis ─────────────────────────────────────────────────

exports.getCopilotAnalysis = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const [profile, insights] = await Promise.all([
      UserProfile.findOne({ user: userId }).lean(),
      Insight.find({ user: userId, status: 'active' }).sort({ createdAt: -1 }).limit(6).lean(),
    ]);

    const payslip = await getLatestPayslipSummary(userId);
    const netSalary = payslip?.netSalary ?? null;
    const grossSalary = payslip?.grossSalary ?? null;

    const budgetAnalysis = analyzeBudget({
      netSalary,
      grossSalary,
      monthlyExpenses: profile?.financial?.monthlyExpensesEstimate,
      monthlyDebts: profile?.financial?.monthlyDebts,
      mortgagePayment: profile?.assets?.mortgageMonthlyPayment,
      savingsEstimate: profile?.financial?.savingsEstimate,
    });

    const investmentRecs = buildInvestmentRecommendations(profile, { grossSalary, netSalary });
    const healthScore = await buildFinancialHealthScore(userId, new Date().getFullYear());

    const goals = (profile?.goals || []).map(g => ({
      id: g._id?.toString(),
      type: g.type,
      label: g.label,
      targetAmount: g.targetAmount,
      currentAmount: g.currentAmount,
      targetDate: g.targetDate,
      priority: g.priority,
      progressPct: g.targetAmount ? Math.min(100, Math.round(((g.currentAmount || 0) / g.targetAmount) * 100)) : 0,
    }));

    res.json({
      success: true,
      data: {
        profile: {
          riskTolerance: profile?.financial?.riskTolerance || null,
          monthlyExpenses: profile?.financial?.monthlyExpensesEstimate || null,
          monthlyDebts: profile?.financial?.monthlyDebts || null,
          savings: profile?.financial?.savingsEstimate || null,
        },
        payslip,
        budgetAnalysis,
        investmentRecs,
        healthScore,
        insights: insights.map(i => ({ title: i.title, description: i.description, type: i.type })),
        goals,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── PUT /api/copilot/profile ──────────────────────────────────────────────────

exports.updateCopilotProfile = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { riskTolerance, monthlyExpenses, monthlyDebts, savings } = req.body;

    const profile = await UserProfile.findOrCreateForUser(userId);
    if (riskTolerance !== undefined) profile.financial.riskTolerance = riskTolerance;
    if (monthlyExpenses !== undefined) profile.financial.monthlyExpensesEstimate = Number(monthlyExpenses) || null;
    if (monthlyDebts !== undefined) profile.financial.monthlyDebts = Number(monthlyDebts) || null;
    if (savings !== undefined) profile.financial.savingsEstimate = Number(savings) || null;
    await profile.save();

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/copilot/goals ───────────────────────────────────────────────────

exports.upsertGoal = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { id, type, label, targetAmount, currentAmount, targetDate, priority } = req.body;

    const profile = await UserProfile.findOrCreateForUser(userId);
    if (id) {
      const goal = profile.goals.id(id);
      if (!goal) return res.status(404).json({ success: false, message: 'יעד לא נמצא' });
      if (type) goal.type = type;
      if (label !== undefined) goal.label = label;
      if (targetAmount !== undefined) goal.targetAmount = Number(targetAmount) || null;
      if (currentAmount !== undefined) goal.currentAmount = Number(currentAmount) || 0;
      if (targetDate !== undefined) goal.targetDate = targetDate;
      if (priority !== undefined) goal.priority = priority;
    } else {
      profile.goals.push({ type: type || 'other', label, targetAmount, currentAmount: currentAmount || 0, targetDate, priority: priority || 3 });
    }
    await profile.save();
    res.json({ success: true, goals: profile.goals });
  } catch (err) {
    next(err);
  }
};

exports.deleteGoal = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const profile = await UserProfile.findOrCreateForUser(userId);
    profile.goals.pull({ _id: id });
    await profile.save();
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/copilot/problems ──────────────────────────────────────────────────

exports.getFinancialProblems = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const [profile, insights] = await Promise.all([
      UserProfile.findOne({ user: userId }).lean(),
      Insight.find({ user: userId, status: 'active' }).sort({ createdAt: -1 }).limit(6).lean(),
    ]);

    const payslip = await getLatestPayslipSummary(userId);
    const netSalary = payslip?.netSalary ?? null;
    const grossSalary = payslip?.grossSalary ?? null;

    const budgetAnalysis = analyzeBudget({
      netSalary,
      grossSalary,
      monthlyExpenses: profile?.financial?.monthlyExpensesEstimate,
      monthlyDebts: profile?.financial?.monthlyDebts,
      mortgagePayment: profile?.assets?.mortgageMonthlyPayment,
      savingsEstimate: profile?.financial?.savingsEstimate,
    });

    const healthScore = await buildFinancialHealthScore(userId, new Date().getFullYear());
    const goals = (profile?.goals || []);

    // ── Detect problems from data ────────────────────────────────────────────
    const problems = [];

    // 1. Savings too low
    if (budgetAnalysis.available && budgetAnalysis.breakdown) {
      const savingsRatio = budgetAnalysis.breakdown.savings.pct / 100;
      if (savingsRatio < 0.10) {
        const idealSavings = Math.round((netSalary || 0) * 0.20);
        const currentSavings = budgetAnalysis.breakdown.savings.amount;
        problems.push({
          id: 'low_savings',
          severity: savingsRatio < 0.05 ? 'critical' : 'warning',
          title: 'חיסכון חודשי נמוך',
          description: `אתה חוסך רק ${budgetAnalysis.breakdown.savings.pct}% מההכנסה. היעד המומלץ הוא 20% לפחות.`,
          impact: `חסרים ₪${(idealSavings - currentSavings).toLocaleString('he-IL')} בחודש להגעה ליעד.`,
          category: 'savings',
        });
      }
    }

    // 2. No emergency fund
    const hasEmergencyGoal = goals.find(g => g.type === 'emergency_fund');
    const monthlyExpenses = profile?.financial?.monthlyExpensesEstimate || 0;
    if (!hasEmergencyGoal && monthlyExpenses > 0) {
      problems.push({
        id: 'no_emergency_fund',
        severity: 'critical',
        title: 'אין קרן חירום',
        description: 'לא הוגדרה קרן חירום. ללא כרית ביטחון, כל הוצאה בלתי צפויה עלולה לגרום לחובות.',
        impact: `מומלץ לשמור לפחות ₪${(monthlyExpenses * 3).toLocaleString('he-IL')} (3 חודשי הוצאות).`,
        category: 'savings',
      });
    } else if (hasEmergencyGoal && hasEmergencyGoal.targetAmount) {
      const pct = (hasEmergencyGoal.currentAmount || 0) / hasEmergencyGoal.targetAmount;
      if (pct < 0.5) {
        problems.push({
          id: 'low_emergency_fund',
          severity: 'warning',
          title: 'קרן חירום חלקית',
          description: `קרן החירום שלך במילוי ${Math.round(pct * 100)}% בלבד. מומלץ להגיע ל-100% בהקדם.`,
          impact: `חסרים עוד ₪${((hasEmergencyGoal.targetAmount - (hasEmergencyGoal.currentAmount || 0))).toLocaleString('he-IL')}.`,
          category: 'savings',
        });
      }
    }

    // 3. High debt ratio
    if (budgetAnalysis.available && budgetAnalysis.breakdown) {
      if (budgetAnalysis.breakdown.fixed.pct > 50) {
        problems.push({
          id: 'high_debt_ratio',
          severity: 'critical',
          title: 'יחס חובות גבוה',
          description: `${budgetAnalysis.breakdown.fixed.pct}% מההכנסה הולך להוצאות קבועות (הלוואות, משכנתא). מעל 50% נחשב מסוכן.`,
          impact: 'זה מגביל את היכולת לחסוך ומגדיל את הסיכון לבעיות בתזרים.',
          category: 'debt',
        });
      } else if (budgetAnalysis.breakdown.fixed.pct > 40) {
        problems.push({
          id: 'elevated_debt',
          severity: 'warning',
          title: 'הוצאות קבועות גבוהות',
          description: `${budgetAnalysis.breakdown.fixed.pct}% מההכנסה מוקדש להוצאות קבועות. כדאי לשאוף לרדת מתחת ל-40%.`,
          impact: 'הפחתה יכולה לשחרר כסף לחיסכון והשקעות.',
          category: 'debt',
        });
      }
    }

    // 4. Low pension contribution
    if (grossSalary && payslip?.pensionEmployee) {
      const pensionRate = payslip.pensionEmployee / grossSalary;
      if (pensionRate < 0.06) {
        problems.push({
          id: 'low_pension',
          severity: 'warning',
          title: 'הפרשת פנסיה נמוכה',
          description: `שיעור ההפרשה שלך (${Math.round(pensionRate * 100)}%) נמוך מהמינימום של 6%. אתה מפסיד כסף מהמעסיק.`,
          impact: `הגדלה ל-7% תוסיף כ-₪${Math.round(grossSalary * 0.01).toLocaleString('he-IL')} לחודש לפנסיה.`,
          category: 'pension',
        });
      }
    }

    // 5. Low health score
    if (healthScore && healthScore.score < 50) {
      problems.push({
        id: 'low_health_score',
        severity: healthScore.score < 30 ? 'critical' : 'warning',
        title: 'ציון בריאות פיננסית נמוך',
        description: `הציון שלך הוא ${healthScore.score}/100. זה מצביע על חוסרים בתיעוד או בתכנון פיננסי.`,
        impact: 'השלמת מסמכים ופרופיל ביטוח ישפרו את הציון משמעותית.',
        category: 'health',
      });
    }

    // 6. No risk profile set
    if (!profile?.financial?.riskTolerance) {
      problems.push({
        id: 'no_risk_profile',
        severity: 'info',
        title: 'לא הוגדר פרופיל סיכון',
        description: 'ללא פרופיל סיכון, המערכת לא יכולה לתת המלצות השקעה מותאמות.',
        impact: 'הגדרת פרופיל תיקח 30 שניות ותשפר את ההמלצות.',
        category: 'planning',
      });
    }

    // 7. No monthly expenses data
    if (!profile?.financial?.monthlyExpensesEstimate) {
      problems.push({
        id: 'no_expenses_data',
        severity: 'info',
        title: 'לא הוזנו הוצאות חודשיות',
        description: 'בלי נתוני הוצאות, אי אפשר לחשב תקציב, תזרים חופשי או המלצות חיסכון.',
        impact: 'הכנס הוצאות משוערות כדי לקבל תמונה פיננסית מלאה.',
        category: 'planning',
      });
    }

    // ── Generate AI fix plans ────────────────────────────────────────────────
    let aiFixPlans = null;
    if (problems.length > 0) {
      try {
        const { askClaude } = require('../services/claudeChatService');
        const problemsSummary = problems.map(p => `- [${p.severity}] ${p.title}: ${p.description}`).join('\n');
        const contextLines = [];
        if (netSalary) contextLines.push(`נטו: ₪${netSalary}`);
        if (grossSalary) contextLines.push(`ברוטו: ₪${grossSalary}`);
        if (budgetAnalysis.monthlyFreeFlow != null) contextLines.push(`תזרים חופשי: ₪${budgetAnalysis.monthlyFreeFlow}`);
        if (monthlyExpenses) contextLines.push(`הוצאות: ₪${monthlyExpenses}`);

        const systemPrompt = [
          'אתה יועץ פיננסי מומחה של FinGuide. המשתמש יש לו בעיות פיננסיות שזוהו אוטומטית.',
          'עליך לתת תוכנית פעולה מפורטת וריאלית לתיקון כל בעיה.',
          'פורמט: JSON מערך של אובייקטים, כל אחד עם: { "problemId": string, "steps": string[] (3-5 צעדים מעשיים), "timeframe": string (כמה זמן צפוי), "expectedResult": string }.',
          'הצעדים צריכים להיות ספציפיים, עם מספרים ופעולות קונקרטיות. אל תהיה גנרי.',
          'ענה רק ב-JSON.',
          '',
          'נתוני המשתמש:',
          contextLines.join('\n') || 'אין נתונים מספיקים',
          '',
          'בעיות שזוהו:',
          problemsSummary,
        ].join('\n');

        const result = await askClaude('תן תוכנית פעולה לתיקון הבעיות הפיננסיות', systemPrompt, []);
        if (result?.answer) {
          const jsonMatch = result.answer.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            aiFixPlans = JSON.parse(jsonMatch[0]);
          }
        }
      } catch {
        // AI plan generation failed — continue without it
      }
    }

    // Fallback: built-in fix steps when AI isn't available
    if (!aiFixPlans || aiFixPlans.length === 0) {
      const BUILTIN_PLANS = {
        low_savings: {
          steps: [
            'הגדר הוראת קבע אוטומטית לחיסכון ביום שאחרי קבלת המשכורת',
            'בדוק אילו מנויים חודשיים אפשר לבטל (סטרימינג, אפליקציות)',
            'השתמש בכלל 50/30/20: 50% צרכים, 30% רצונות, 20% חיסכון',
            'הגדל את החיסכון ב-₪200 כל חודש עד שתגיע ליעד',
          ],
          timeframe: '3-6 חודשים',
          expectedResult: 'חיסכון של 20% מההכנסה נטו',
        },
        no_emergency_fund: {
          steps: [
            'פתח חשבון חיסכון נפרד ייעודי לקרן חירום',
            'הגדר הוראת קבע חודשית — גם ₪500 זה התחלה',
            'יעד ביניים: חודש הוצאות תוך 3 חודשים',
            'יעד סופי: 3 חודשי הוצאות — אל תיגע בכסף הזה',
          ],
          timeframe: '6-12 חודשים',
          expectedResult: 'כרית ביטחון של 3 חודשי הוצאות',
        },
        low_emergency_fund: {
          steps: [
            'הגדל את ההפקדה החודשית לקרן החירום',
            'הפנה בונוסים, מענקים או החזרי מס ישירות לקרן',
            'שקול להעביר חיסכון בריבית נמוכה לפיקדון רווחי יותר',
            'הגדר תזכורת חודשית לבדוק את ההתקדמות',
          ],
          timeframe: '3-9 חודשים',
          expectedResult: 'קרן חירום מלאה ב-100%',
        },
        high_debt_ratio: {
          steps: [
            'רשום את כל החובות — סכום, ריבית, תאריך סיום',
            'התחל מהחוב עם הריבית הגבוהה ביותר (שיטת המפולת)',
            'בדוק אפשרות למחזור הלוואות בריבית נמוכה יותר',
            'הימנע מלקיחת אשראי חדש עד שהחוב יורד מתחת ל-40%',
          ],
          timeframe: '6-18 חודשים',
          expectedResult: 'הורדת יחס חובות מתחת ל-40% מההכנסה',
        },
        elevated_debt: {
          steps: [
            'מפה את כל ההוצאות הקבועות ובדוק מה ניתן לצמצם',
            'שקול מחזור משכנתא אם הריבית ירדה מאז לקחת אותה',
            'נסה לנהל משא ומתן על חוזי שירות (אינטרנט, ביטוח רכב)',
            'כל שקל שמשתחרר — הפנה לחיסכון',
          ],
          timeframe: '1-3 חודשים',
          expectedResult: 'ירידה של 5-10% בהוצאות קבועות',
        },
        low_pension: {
          steps: [
            'פנה למחלקת HR ובקש להגדיל הפרשה ל-7%',
            'הגדלה מצד העובד מגדילה אוטומטית את חלק המעסיק',
            'בדוק שיש לך גם קרן השתלמות — הטבת מס משמעותית',
            'השווה בין קרנות פנסיה — דמי ניהול נמוכים חוסכים עשרות אלפים',
          ],
          timeframe: 'מיידי (תוך שבוע)',
          expectedResult: 'תוספת של אלפי שקלים בשנה לפנסיה',
        },
        low_health_score: {
          steps: [
            'העלה תלושי שכר של 3 החודשים האחרונים',
            'העלה טופס 106 השנתי',
            'השלם את פרופיל הביטוחים (חיים, בריאות, דירה)',
            'מלא את ההוצאות החודשיות המשוערות',
          ],
          timeframe: '15-30 דקות',
          expectedResult: 'שיפור של 20-40 נקודות בציון הבריאות',
        },
        no_risk_profile: {
          steps: [
            'גלול למטה ובחר פרופיל סיכון (שמרני / מאוזן / אגרסיבי)',
            'אם אתה מתחת לגיל 35 — בדרך כלל "מאוזן" מתאים',
            'אם יש לך משכנתא ומשפחה — "שמרני" עדיף',
          ],
          timeframe: '30 שניות',
          expectedResult: 'המלצות השקעה מותאמות אישית',
        },
        no_expenses_data: {
          steps: [
            'בדוק את חשבון הבנק — כמה יצא בממוצע ב-3 חודשים אחרונים',
            'הכנס את הסכום בקירוב בעמוד הזה (כפתור "עדכן הוצאות")',
            'אל תשכח להוסיף הלוואות ותשלומי משכנתא',
          ],
          timeframe: '5 דקות',
          expectedResult: 'ניתוח תקציב מלא + תזרים חופשי',
        },
      };

      aiFixPlans = problems
        .filter(p => BUILTIN_PLANS[p.id])
        .map(p => ({
          problemId: p.id,
          ...BUILTIN_PLANS[p.id],
        }));
    }

    // Sort by severity
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    problems.sort((a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9));

    res.json({ success: true, data: { problems, aiFixPlans } });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/copilot/monthly-report ─────────────────────────────────────────

exports.generateReport = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const [profile, insights] = await Promise.all([
      UserProfile.findOne({ user: userId }).lean(),
      Insight.find({ user: userId, status: 'active' }).sort({ createdAt: -1 }).limit(6).lean(),
    ]);

    const payslip = await getLatestPayslipSummary(userId);
    const netSalary = payslip?.netSalary ?? null;
    const grossSalary = payslip?.grossSalary ?? null;

    const budgetAnalysis = analyzeBudget({
      netSalary,
      grossSalary,
      monthlyExpenses: profile?.financial?.monthlyExpensesEstimate,
      monthlyDebts: profile?.financial?.monthlyDebts,
      mortgagePayment: profile?.assets?.mortgageMonthlyPayment,
      savingsEstimate: profile?.financial?.savingsEstimate,
    });

    const investmentRecs = buildInvestmentRecommendations(profile, { grossSalary, netSalary });
    const healthScore = await buildFinancialHealthScore(userId, new Date().getFullYear());

    const result = await generateMonthlyReport({
      profile,
      budgetAnalysis,
      investmentRecs,
      healthScore,
      insights,
      latestPayslip: payslip,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};
