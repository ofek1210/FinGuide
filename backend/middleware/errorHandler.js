/**
 * Error Handler Middleware
 * מטפל בכל השגיאות בצורה מרכזית
 */

/**
 * טיפול בשגיאות Mongoose
 */
const handleMongooseError = err => {
  let error = { ...err };
  error.message = err.message;

  // שגיאת duplicate key (למשל אימייל כפול)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `${field} כבר קיים במערכת`;
    error = {
      message,
      statusCode: 400,
    };
  }

  // שגיאת validation
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(val => val.message);
    error = {
      message: messages.join(', '),
      statusCode: 400,
    };
  }

  // שגיאת Cast (ObjectId לא תקין)
  if (err.name === 'CastError') {
    error = {
      message: 'משאב לא נמצא',
      statusCode: 404,
    };
  }

  return error;
};

/**
 * Error Handler Middleware
 */
const errorHandler = (err, req, res) => {
  let error = { ...err };
  error.message = err.message;

  // טיפול בשגיאות Mongoose
  if (
    err.name === 'ValidationError' ||
    err.name === 'CastError' ||
    err.code === 11000
  ) {
    error = handleMongooseError(err);
  }

  // טיפול בשגיאות JWT
  if (err.name === 'JsonWebTokenError') {
    error = {
      message: 'Token לא תקין',
      statusCode: 401,
    };
  }

  if (err.name === 'TokenExpiredError') {
    error = {
      message: 'Token פג תוקף',
      statusCode: 401,
    };
  }

  // Log שגיאה ל-console (בפיתוח)
  if (process.env.NODE_ENV === 'development') {
    console.error('❌ שגיאה:', err);
  }

  // תגובה
  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'שגיאת שרת',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
