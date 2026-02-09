class AppError extends Error {
  constructor(message, statusCode = 500, type = 'AppError', details = []) {
    super(message);
    this.statusCode = statusCode;
    this.type = type;
    this.details = Array.isArray(details) ? details : [details];
    this.isOperational = true;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

class ValidationError extends AppError {
  constructor(message = 'שגיאות בולידציה', details = []) {
    super(message, 400, 'ValidationError', details);
  }
}

class AuthError extends AppError {
  constructor(message = 'לא מורשה', statusCode = 401, details = []) {
    super(message, statusCode, 'AuthError', details);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'משאב לא נמצא', details = []) {
    super(message, 404, 'NotFoundError', details);
  }
}

class FileUploadError extends AppError {
  constructor(message = 'שגיאה בהעלאת הקובץ', details = []) {
    super(message, 400, 'FileUploadError', details);
  }
}

module.exports = {
  AppError,
  ValidationError,
  AuthError,
  NotFoundError,
  FileUploadError,
};
