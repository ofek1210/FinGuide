## סיכום
- **פרופיל/הגדרות**: דף הגדרות לעריכה (שם, אימייל read-only, Avatar דמו), כפתור שמירה (מוכן ל-PATCH כשהבאק יתווסף).
- **Topbar**: Avatar + תפריט (הגדרות פרופיל, התנתקות) ב-PrivateTopbar וב-DashboardHeader.
- **RTL**: שורת ניווט ו-topbar עם direction RTL.
- **צמצום בקשות**: useDashboardUser ו-SettingsPage משתמשים ב-useAuth בלבד (בלי getMe כפול); rate limit בבאק הוגדל לפיתוח (2000/15min).
- **תיעוד**: docs/FRONTEND-BACKEND-ROADMAP.md – סקירת API, מה יש/אין במסמכים, איפה להתקדם בפרונט בלבד.

## קבצים
- **frontend**: PrivateTopbar, DashboardHeader, SettingsPage, profile.api, auth.api (avatarUrl), useDashboardUser, App.css
- **backend**: app.js (rate limit)
- **docs**: FRONTEND-BACKEND-ROADMAP.md

## Commits
- פרופיל/הגדרות: Topbar עם Avatar ותפריט, דף הגדרות לעריכה, RTL, צמצום בקשות ו-rate limit לפיתוח
- docs: roadmap פרונט-באק ומדריך התקדמות פרונט בלבד
