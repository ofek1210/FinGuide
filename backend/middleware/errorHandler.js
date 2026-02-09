const { AppError } = require('../utils/appErrors');

const buildDetailsFromMongoose = err =>
  Object.values(err.errors || {}).map(item => ({
    field: item.path,
    message: item.message,
    value: item.value,
  }));

const normalizeError = err => {
  if (err instanceof AppError) {
    return {
      statusCode: err.statusCode,
      type: err.type || err.name,
      message: err.message,
      details: err.details || [],
    };
  }

  if (err && err.name === 'ValidationError' && err.errors) {
    return {
      statusCode: 400,
      type: 'ValidationError',
      message: 'שגיאות בולידציה',
      details: buildDetailsFromMongoose(err),
    };
  }

  if (err && err.name === 'CastError') {
    return {
      statusCode: 404,
      type: 'NotFoundError',
      message: 'משאב לא נמצא',
      details: err.path ? [{ field: err.path, value: err.value }] : [],
    };
  }

  if (err && err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0];
    return {
      statusCode: 400,
      type: 'DuplicateKeyError',
      message: `${field} כבר קיים במערכת`,
      details: field ? [{ field, value: err.keyValue[field] }] : [],
    };
  }

  if (err && err.name === 'JsonWebTokenError') {
    return {
      statusCode: 401,
      type: 'AuthError',
      message: 'Token לא תקין',
      details: [],
    };
  }

  if (err && err.name === 'TokenExpiredError') {
    return {
      statusCode: 401,
      type: 'AuthError',
      message: 'Token פג תוקף',
      details: [],
    };
  }

  if (err && err.name === 'MulterError') {
    const isLargeFile = err.code === 'LIMIT_FILE_SIZE';
    return {
      statusCode: 400,
      type: 'FileUploadError',
      message: isLargeFile
        ? 'הקובץ גדול מדי. מקסימום 10MB'
        : 'שגיאה בהעלאת הקובץ',
      details: err.code ? [{ code: err.code }] : [],
    };
  }

  if (err && err.type === 'entity.parse.failed') {
    return {
      statusCode: 400,
      type: 'BadRequestError',
      message: 'בקשה לא תקינה',
      details: [],
    };
  }

  return {
    statusCode: err.statusCode || 500,
    type: err.type || err.name || 'InternalServerError',
    message: err.message || 'שגיאת שרת',
    details: err.details || [],
  };
};

const errorHandler = (err, req, res, next) => {
  const normalized = normalizeError(err);

  if (process.env.NODE_ENV === 'development') {
    console.error('❌ שגיאה:', err);
  }

  const payload = {
    success: false,
    message: normalized.message,
    error: {
      type: normalized.type,
      message: normalized.message,
      details: normalized.details || [],
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  };

  if (payload.error.details && payload.error.details.length > 0) {
    payload.errors = payload.error.details;
  }

  res.status(normalized.statusCode).json(payload);
};

module.exports = errorHandler;
