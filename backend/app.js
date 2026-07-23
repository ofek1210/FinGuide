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
const profileRoutes = require('./routes/profile');
const insightsRoutes = require('./routes/insights');
const recommendationsRoutes = require('./routes/recommendations');
const notificationsRoutes = require('./routes/notifications');
const gmailIntegrationRoutes = require('./routes/gmailIntegration');
const taxAssistantRoutes = require('./routes/taxAssistant');
const financialHealthRoutes = require('./routes/financialHealth');
const copilotRoutes = require('./routes/copilot');
const scoreAgentRoutes = require('./routes/scoreAgent');
const pensionRoutes = require('./routes/pension');
const gemelRoutes = require('./routes/gemel');
const insuranceRoutes = require('./routes/insurance');
const dashboardRoutes = require('./routes/dashboard');
const agentRoutes = require('./routes/agents');
const govRoutes = require('./routes/gov');
const summaryEmailRoutes = require('./routes/summaryEmail');
const executiveReportRoutes = require('./routes/executiveReport');
const smartOnboardingRoutes = require('./routes/smartOnboarding');

const createApp = () => {
  const app = express();

  // בפרוד האפליקציה יושבת מאחורי nginx (reverse proxy) — בלי זה
  // ה-rate limiter רואה את כל המשתמשים כ-127.0.0.1 וחוסם את כולם יחד
  app.set('trust proxy', 1);

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
  app.use(express.json({ strict: false }));
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
  app.use('/api/smart-onboarding', smartOnboardingRoutes);
  app.use('/api/profile', profileRoutes);
  app.use('/api/insights', insightsRoutes);
  app.use('/api/recommendations', recommendationsRoutes);
  app.use('/api/notifications', notificationsRoutes);
  app.use('/api/integrations/gmail', gmailIntegrationRoutes);
  app.use('/api/tax-assistant', taxAssistantRoutes);
  app.use('/api/financial-health', financialHealthRoutes);
  app.use('/api/copilot', copilotRoutes);
  app.use('/api/score-agent', scoreAgentRoutes);
  app.use('/api/pension', pensionRoutes);
  app.use('/api/gemel', gemelRoutes);
  app.use('/api/insurance', insuranceRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/agents', agentRoutes);
  app.use('/api/gov', govRoutes);
  app.use('/api/summary-email', summaryEmailRoutes);
  app.use('/api/executive', executiveReportRoutes);

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
