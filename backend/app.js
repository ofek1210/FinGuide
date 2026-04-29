const path = require('path');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const errorHandler = require('./middleware/errorHandler');

// Routes
const authRoutes = require('./routes/auth');
const documentRoutes = require('./routes/documents');
const aiRoutes = require('./routes/ai');
const findingsRoutes = require('./routes/findings');
const onboardingRoutes = require('./routes/onboarding');

const createApp = () => {
  const app = express();

  // Rate limiting – גבוה בפיתוח כדי למנוע "יותר מדי בקשות"
  const isDev = process.env.NODE_ENV !== 'production';
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 דקות
    max: isDev ? 2000 : 100, // פיתוח: 2000, פרוד: 100
    message: {
      success: false,
      message: 'יותר מדי בקשות, נסה שוב מאוחר יותר',
    },
  });

  // Middleware
  app.use(limiter);
  const allowedOrigins = [
    process.env.CLIENT_URL,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ].filter(Boolean);
  const defaultOrigin = 'http://localhost:5173';
  const corsOrigin = (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.length === 0) return cb(null, defaultOrigin);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    cb(null, false);
  };
  app.use(
    cors({
      origin: corsOrigin,
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(
    '/uploads/profile-images',
    express.static(path.join(__dirname, 'uploads', 'profile-images'))
  );

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      success: true,
      message: 'Server is running',
      timestamp: new Date().toISOString(),
    });
  });

  // בדיקות אינטגרציה: route יזום לזריקת שגיאה
  if (process.env.NODE_ENV === 'test') {
    app.get('/api/__test/error', (req, res, next) => {
      next(new Error('forced_test_error'));
    });
  }

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/documents', documentRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/findings', findingsRoutes);
  app.use('/api/onboarding', onboardingRoutes);

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      message: 'Route not found',
    });
  });

  // Error handler (חייב להיות אחרון)
  app.use(errorHandler);

  return app;
};

module.exports = createApp;
