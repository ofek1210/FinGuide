require('dotenv').config();

const path = require('path');
const express = require('express');
const connectDB = require('./config/db');
const createApp = require('./app');

const DEFAULT_PORT = 5000;
const MAX_PORT_ATTEMPTS = 5;

let server;

const validateEnv = () => {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 10) {
    throw new Error('JWT_SECRET חסר או חלש – הגדר ב-.env (לפחות 10 תווים)');
  }

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI חסר – הגדר ב-.env');
  }
};

const startServer = async (port, attempt = 0) => {
  validateEnv();
  await connectDB();

  const app = createApp();

  app.use(
    '/uploads',
    express.static(path.join(__dirname, 'uploads'))
  );

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
