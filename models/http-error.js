class HttpError extends Error {
  constructor(message, errorCode, status = "error") {
    super(message);
    this.code = errorCode;
    this.status = status;
  }
}

module.exports = HttpError;
