require('dotenv').config();

const connectDB = require('./config/db');
const createApp = require('./app');
const {
  resumePendingDocumentProcessing,
} = require('./services/documentProcessingService');

const DEFAULT_PORT = 5001;

let server;
let app;

// ולידציה של משתני סביבה קריטיים בהפעלה
const validateEnv = () => {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 10) {
    throw new Error('JWT_SECRET חסר או חלש – הגדר ב-.env (לפחות 10 תווים)');
  }
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI חסר – הגדר ב-.env');
  }
};

// הפעלת השרת
const startServer = async port => {
  try {
    validateEnv();
    await connectDB();

    app = createApp();

    server = app.listen(port, () => {
      console.log(`🚀 Server running on port ${port}`);
      console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);

      resumePendingDocumentProcessing()
        .then(count => {
          if (count > 0) {
            console.log(`📄 Resumed ${count} pending OCR document(s)`);
          }
        })
        .catch(error => {
          console.error('❌ Failed to resume pending OCR documents:', error);
        });
    });

    server.on('error', err => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${port} is already in use. Update PORT or free the port.`);
        process.exit(1);
        return;
      }

      console.error('❌ Server failed to start:', err);
      process.exit(1);
    });
  } catch (err) {
    console.error('❌ Failed to initialize server:', err);
    process.exit(1);
  }
};

const basePort = Number(process.env.PORT) || DEFAULT_PORT;
startServer(basePort);

process.on('unhandledRejection', err => {
  console.error('❌ Unhandled Rejection:', err);
  process.exit(1);
});

module.exports = {
  startServer,
  validateEnv,
};
