# FinGuide

פלטפורמה לניתוח תלושי שכר ישראליים עם חילוץ OCR, ממצאים אוטומטיים ועוזר AI.
Monorepo: `backend/` (Node + Express + Mongo) ו־`frontend/` (React + Vite).

## הרצה

```bash
./start.sh
```

זה מתקין תלויות בפעם הראשונה ומעלה backend + frontend יחד. אחרי שעולה:

- Frontend: <http://localhost:5173>
- Backend:  <http://localhost:5000>

## דרישות

- Node.js 18+
- MongoDB רץ מקומית על `localhost:27017` (או Atlas — מגדירים ב־`MONGODB_URI`)
- `backend/.env` קיים. בפעם הראשונה:
  ```bash
  cp backend/.env.example backend/.env
  ```
  ערכים מינימליים שחייבים: `MONGODB_URI`, `JWT_SECRET` (≥10 תווים).

## OCR

חילוץ PDF דורש `poppler-utils` ו־`tesseract` (עברית + אנגלית) מותקנים מערכתית.
מי שלא רוצה להתקין — `npm run dev:docker` מרים backend + Mongo בקונטיינר עם הכלים מוכנים (backend נחשף ל־host על port **5001**, אז להוסיף `VITE_API_URL=http://127.0.0.1:5001` ב־`frontend/.env`).

## פקודות שימושיות

```bash
npm test            # backend + frontend + vite build
npm run lint
npm run dev:backend # רק backend
npm run dev:frontend
```

## תיעוד נוסף

- `CLAUDE.md` — סקירה ארכיטקטונית מלאה, מבנה `analysisData`, מודלים, ועוד.
- `docs/ARCHITECTURE_DEEP_DIVE.md` — צלילה עמוקה.
