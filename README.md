# FinGuide - פלטפורמה לניתוח תלושי שכר

פלטפורמה מתקדמת לניתוח וניהול תלושי שכר עם יכולות AI.

## 🚀 התחלה מהירה

### דרישות מוקדמות
- Node.js (גרסה 18 ומעלה)
- MongoDB (Local או Atlas)
- npm או yarn

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
- `GET /api/auth/me` - קבלת משתמש נוכחי (דורש JWT)

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

Backend Lead: [שם]

---

**הערה:** זהו setup ראשוני. פיצ'רים נוספים יועלו בהמשך.
