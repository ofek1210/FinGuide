require('dotenv').config();

const connectDB = require('./config/db');
const { startDocumentWorker } = require('./services/documentProcessingService');

const validateEnv = () => {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 10) {
    throw new Error('JWT_SECRET חסר או חלש – הגדר ב-.env (לפחות 10 תווים)');
  }
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI חסר – הגדר ב-.env');
  }
};

const startWorker = async () => {
  validateEnv();
  await connectDB();
  console.log('🛠️ OCR worker connected to MongoDB');
  await startDocumentWorker();
};

startWorker().catch(error => {
  console.error('❌ OCR worker failed to start:', error);
  process.exit(1);
});
