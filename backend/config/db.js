const mongoose = require('mongoose');

/**
 * חיבור ל-MongoDB
 * תומך ב-local MongoDB ו-MongoDB Atlas
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      // אופציות מומלצות ל-Mongoose 6+
      // (אין צורך ב-useNewUrlParser ו-useUnifiedTopology בגרסאות חדשות)
    });

    console.log(`✅ MongoDB מחובר: ${conn.connection.host}`);
    
    // טיפול באירועי חיבור
    mongoose.connection.on('error', (err) => {
      console.error('❌ שגיאת MongoDB:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ MongoDB מנותק');
    });

    // טיפול בסגירת השרת
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('MongoDB connection closed due to app termination');
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ שגיאה בחיבור ל-MongoDB:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
