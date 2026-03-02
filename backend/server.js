require('dotenv').config();

const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const { NotFoundError } = require('./utils/appErrors');

// Routes
const authRoutes = require('./routes/auth');
const documentRoutes = require('./routes/documents');
const aiRoutes = require('./routes/ai');
const findingsRoutes = require('./routes/findings');

// יצירת Express app
const app = express();

// חיבור ל-MongoDB (מדולל כדי לאפשר overriding בטסטים)
connectDB();

// ולידציה של משתני סביבה קריטיים בהפעלה
const validateEnv = () => {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 10) {
    throw new Error('JWT_SECRET חסר או חלש – הגדר ב-.env (לפחות 10 תווים)');
  }

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI חסר – הגדר ב-.env');
  }
};

const startServer = async () => {
  validateEnv();
  await connectDB();

  const app = createApp();
  const PORT = process.env.PORT || 5000;

  const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  });

// 404 handler
app.use((req, res, next) => {
  next(new NotFoundError('Route not found'));
});

  return { app, server };
};

// הפעלת השרת
const PORT = process.env.PORT || 5000;

const startServer = (port, attempt = 0) => {
  server = app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  });

  server.on('error', err => {
    if (err.code === 'EADDRINUSE' && attempt < MAX_PORT_ATTEMPTS) {
      const nextPort = port + 1;
      console.warn(`⚠️ Port ${port} in use, trying ${nextPort}...`);
      startServer(nextPort, attempt + 1);
      return;
    }

    console.error('❌ Server failed to start:', err);
    process.exit(1);
  });
};

const basePort = Number(process.env.PORT) || DEFAULT_PORT;
startServer(basePort);

// טיפול בשגיאות לא צפויות
process.on('unhandledRejection', err => {
  console.error('❌ Unhandled Rejection:', err);
  if (server) {
    server.close(() => {
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
});

module.exports = {
  startServer,
  validateEnv,
};
