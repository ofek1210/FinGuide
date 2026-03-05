# עבודה עם Git – FinGuide

## עקרונות

- **ענף לכל פיצ'ר:** עובדים על `feat/...` (או `fix/...`), לא ישירות על `main`.
- **רענון לפני התחלה:** `git pull origin main` לפני יצירת ענף חדש או התחלת משימה.
- **קומיטים קטנים ולוגיים:** קומיט אחד = שינוי אחד (תיקון / פיצ'ר אחד / מסמך אחד).

## שמות ענפים

| סוג | דוגמה |
|-----|--------|
| פיצ'ר | `feat/frontend-ocr-integration` |
| תיקון | `fix/duplicate-connectdb` |
| תיעוד/תחזוקה | `chore/update-docs` |

## פורמט הודעות קומיט

- **אנגלית או עברית** – עקביות בפרויקט.
- **תחילית:** `feat:`, `fix:`, `chore:`, `docs:`.
- **דוגמאות:**
  - `fix: remove duplicate connectDB in server.js`
  - `feat(frontend): map analysisData to PayslipDetail`
  - `docs: add FRONTEND-TODO and GIT-WORKFLOW`

## זרימה יומית

1. **בתחילת עבודה:**  
   `git pull origin main`  
   אם יש ענף פיצ'ר: `git checkout feat/your-branch` ואז `git pull origin main` (או merge/rebase לפי מדיניות).

2. **במהלך עבודה:**  
   קומיטים קטנים עם הודעות ברורות.

3. **סיום פיצ'ר:**  
   דחיפה ל־origin, פתיחת PR/merge ל־`main` לפי מדיניות הפרויקט.

## מה לא לעשות

- לא לעשות קומיט ל־`node_modules/`, `.env`, קבצי build או קבצים שמופיעים ב־`.gitignore`.
- לא לעשות קומיט ענף שלם בלי לבדוק `git status` ו־`git diff`.
