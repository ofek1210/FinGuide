const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const errorHandler = require('./middleware/errorHandler');

// Routes
const authRoutes = require('./routes/auth');
const documentRoutes = require('./routes/documents');
const aiRoutes = require('./routes/ai');
const findingsRoutes = require('./routes/findings');

const createApp = () => {
  const app = express();

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 דקות
    max: 100, // 100 בקשות לכל IP
    message: {
      success: false,
      message: 'יותר מדי בקשות, נסה שוב מאוחר יותר',
    },
  });

  // Middleware
  app.use(limiter);
  app.use(
    cors({
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

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
