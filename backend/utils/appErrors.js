class AppError extends Error {
  constructor(message, statusCode = 400, errors = undefined) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;

    if (errors && Array.isArray(errors) && errors.length > 0) {
      this.errors = errors;
    }

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

class ValidationError extends AppError {
  constructor(message, errors = undefined) {
    super(message, 400, errors);
  }
}

class FileUploadError extends AppError {
  constructor(message, errors = undefined) {
    super(message, 400, errors);
  }
}

module.exports = {
  AppError,
  ValidationError,
  FileUploadError,
};

