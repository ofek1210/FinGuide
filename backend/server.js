require('dotenv').config();

const connectDB = require('./config/db');
const createApp = require('./app');

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

  // טיפול בשגיאות לא צפויות
  process.on('unhandledRejection', err => {
    console.error('❌ Unhandled Rejection:', err);
    server.close(() => {
      process.exit(1);
    });
  });

  return { app, server };
};

if (require.main === module) {
  startServer().catch(err => {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  });
}

module.exports = {
  startServer,
  validateEnv,
};
