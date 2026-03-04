require('dotenv').config();

const path = require('path');
const express = require('express');
const connectDB = require('./config/db');
const createApp = require('./app');

const DEFAULT_PORT = 5000;
const MAX_PORT_ATTEMPTS = 10;

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
const startServer = async (port, attempt = 0) => {
  try {
    validateEnv();
    await connectDB();

    app = createApp();

    server = app.listen(port, () => {
      console.log(`🚀 Server running on port ${port}`);
      console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    server.on('error', err => {
      if (err.code === 'EADDRINUSE' && attempt < MAX_PORT_ATTEMPTS) {
        const nextPort = port + 1;
        console.warn(`⚠️ Port ${port} in use, trying ${nextPort}...`);
        // ניסיון מחדש על פורט אחר
        startServer(nextPort, attempt + 1);
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
// הרצה מיידית כאשר הקובץ נטען
void startServer(basePort);

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
