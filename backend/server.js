require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const { NotFoundError } = require('./utils/appErrors');

// Routes
const authRoutes = require('./routes/auth');
const documentRoutes = require('./routes/documents');
const aiRoutes = require('./routes/ai');

// חיבור ל-MongoDB
connectDB();

// יצירת Express app
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

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/ai', aiRoutes);

// 404 handler
app.use((req, res, next) => {
  next(new NotFoundError('Route not found'));
});

// Error handler (חייב להיות אחרון)
app.use(errorHandler);

// הפעלת השרת
const PORT = process.env.PORT || 3000;

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
