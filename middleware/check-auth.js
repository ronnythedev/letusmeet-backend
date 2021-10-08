const jwt = require("jsonwebtoken");
const HttpError = require("../models/http-error");

module.exports = (req, res, next) => {
  if (req.method === "OPTIONS") {
    return next();
  }
  try {
    const token = req.headers.authorization.split(" ")[1];
    if (!token) {
      throw new Error("Authentication Failed.");
    }

    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    req.userData = { uid: decodedToken.uid };
    next();
  } catch (error) {
    return next(new HttpError("Authentication Failed.", 403));
  }
};
