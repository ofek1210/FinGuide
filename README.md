# FinGuide - פלטפורמה לניתוח תלושי שכר

פלטפורמה מתקדמת לניתוח וניהול תלושי שכר עם יכולות AI.

## 🚀 התחלה מהירה

### דרישות מוקדמות
- Node.js (גרסה 18 ומעלה) – לפיתוח מקומי ללא Docker
- MongoDB (Local או Atlas) – לפיתוח מקומי ללא Docker
- npm או yarn
- לחלופין: **Docker / Docker Desktop** (מומלץ להרצה עם OCR, ללא התקנות מערכתיות נוספות)

### התקנה

1. **שכפול הפרויקט**
```bash
git clone <repository-url>
cd FinGuide
```

2. **התקנת תלויות Backend**
```bash
cd backend
npm install
```

3. **הגדרת משתני סביבה**
```bash
cp .env.example .env
```

ערוך את קובץ `.env` והוסף את הערכים שלך:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/finguide
JWT_SECRET=your-super-secret-key-change-this
JWT_EXPIRE=7d
CLIENT_URL=http://localhost:5173
GOOGLE_CLIENT_ID=your-google-web-client-id
```

**חשוב:** שנה את `JWT_SECRET` למפתח אקראי וחזק!

4. **הרצת השרת**
```bash
# Development mode (עם nodemon)
npm run dev

# Production mode
npm start
```

השרת ירוץ על `http://localhost:5000`

## ⚡ הרצה מאוחדת (Backend + Frontend)

ניתן להרים את כל הפרויקט מהתיקייה הראשית בפקודה אחת.

### התקנה (פעם ראשונה)
מהתיקייה הראשית של הפרויקט:

```bash
npm run install:all
```

### הרצה

```bash
npm run dev
```

ברירת מחדל לאחר עלייה:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000`

### חשוב
- MongoDB נשאר שירות חיצוני ולא מורם אוטומטית במוד `npm run dev`.
- ודאו ש־MongoDB רץ לפני `npm run dev`.

## 🐳 הרצה עם Docker (מומלץ ל־OCR)

כדי ש־OCR על קבצי PDF יעבוד לכל המפתחים ולסביבות Deployment ללא התקנת Poppler/Tesseract על המחשב המקומי, קיימת תצורת Docker שמרימה:
- MongoDB
- Backend (כולל Poppler + Tesseract בתוך הקונטיינר)

### דרישות
- Docker / Docker Desktop מותקן ופעיל (Windows / Mac / Linux)

### הרמה

מהתיקייה הראשית של הפרויקט:

```bash
npm run dev:docker
```

זוהי מעטפת ל:

```bash
docker compose up --build
```

אחרי עלייה:
- Backend בתוך Docker מאזין על פורט 5000, ונחשף ל־host כ־`http://localhost:5001`
- MongoDB רץ בקונטיינר `mongo`

הפרונטאנד עדיין רץ מחוץ ל־Docker (Vite):

```bash
cd frontend
npm install        # פעם ראשונה
npm run dev
```

ולאחר מכן נכנסים ל־`http://localhost:5173`.

### למה Docker חשוב ל־OCR?

עיבוד PDF ↦ תמונה ↦ OCR נשען על כלים חיצוניים:
- `pdftoppm` (מ־Poppler) להמרת PDF לתמונות
- `tesseract` ל־OCR (כולל עברית)

בסביבת Docker (קובץ `backend/Dockerfile`) הכלים האלו מותקנים אוטומטית, כך שכל מפתח וכל סביבה מריצה בדיוק אותו סט כלים – ללא צורך בהתקנה ידנית של Poppler/Tesseract במערכת ההפעלה.

אם מריצים את ה־backend ישירות מהמחשב (ללא Docker) בלי Poppler/Tesseract מותקנים, OCR על PDF ייכשל, אך השגיאות יופיעו ב־log עם הסבר ברור כיצד להריץ דרך Docker.

### פקודות נוספות ברמת ה-root

```bash
# הרצת כל צד בנפרד
npm run dev:backend
npm run dev:frontend

# בדיקות עזר
npm run lint
npm run test
```

### Troubleshooting קצר
- אם ה־backend נופל בגלל `MONGODB_URI` או `JWT_SECRET`:
  בדקו את `backend/.env`.
- אם פורט תפוס (`5000` או `5173`):
  שחררו את הפורט התפוס או עדכנו הגדרות פורט בהתאם.
- אם התחברות Google לא עובדת:
  ודאו ש־`GOOGLE_CLIENT_ID` מוגדר ב־`backend/.env` וש־`VITE_GOOGLE_CLIENT_ID`
  מוגדר ב־`frontend/.env` עם אותו ערך.

## 📁 מבנה הפרויקט

```
FinGuide/
├── backend/
│   ├── config/          # הגדרות (DB, etc.)
│   ├── controllers/     # לוגיקת בקשה-תגובה
│   ├── middleware/      # Middleware (auth, errors)
│   ├── models/          # Mongoose models
│   ├── routes/          # API routes
│   └── uploads/         # קבצים שהועלו
└── frontend/            # Frontend (יועלה בהמשך)
```

## 🔌 API Endpoints

### Health Check
- `GET /api/health` - בדיקת סטטוס השרת

### Authentication
- `POST /api/auth/register` - הרשמה
- `POST /api/auth/login` - התחברות
- `POST /api/auth/google` - התחברות עם Google ID Token
- `GET /api/auth/me` - קבלת משתמש נוכחי (דורש JWT)

## 🔐 Google Sign-In Setup

1. ב־Google Cloud Console צרו OAuth Client מסוג `Web application`.
2. הגדירו Authorized JavaScript Origins:
   - `http://localhost:5173`
   - דומיין production (אם קיים).
3. הגדירו ב־backend (`backend/.env`):
```env
GOOGLE_CLIENT_ID=your-google-web-client-id
```
4. הגדירו ב־frontend (`frontend/.env`):
```env
VITE_GOOGLE_CLIENT_ID=your-google-web-client-id
```
5. ודאו שהערך זהה בשני הצדדים.

### תקלות נפוצות ב-Google Login
- `origin_mismatch`: ה-Origin של הפרונט לא הוגדר ב־Google Console.
- `Google credential לא תקף`: token לא תקין/פג תוקף או Client ID לא תואם.
- `Google auth לא הוגדר בשרת`: חסר `GOOGLE_CLIENT_ID` בצד backend.

## 📝 דוגמאות שימוש

### הרשמה
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "יוסי כהן",
    "email": "yossi@example.com",
    "password": "password123"
  }'
```

### התחברות
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "yossi@example.com",
    "password": "password123"
  }'
```

### קבלת משתמש נוכחי
```bash
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 🔒 אבטחה

- סיסמאות מוצפנות עם bcrypt
- JWT tokens לאבטחת endpoints
- CORS מוגדר
- Rate limiting (מומלץ להוסיף)

## 🛠️ טכנולוגיות

### Backend
- **Node.js** - Runtime environment
- **Express** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM
- **JWT** - Authentication
- **bcryptjs** - Password hashing
- **Multer** - File uploads

## 📄 רישיון

פרויקט גמר - כל הזכויות שמורות

## 👥 צוות

Backend Lead: SegevPartush

---

**הערה:** זהו setup ראשוני. פיצ'רים נוספים יועלו בהמשך.
