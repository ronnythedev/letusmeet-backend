// third-party packages
const { validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// models
const User = require("../models/user");
const TimeZone = require("../models/timeZone");
const HttpError = require("../models/http-error");

const signIn = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new HttpError(
      "Invalid input information. Please check your data.",
      422
    );
  }

  const { email, password } = req.body;

  let foundUser;
  try {
    foundUser = await User.findOne({ email: email, isActive: true });
  } catch (error) {
    return next(
      new HttpError(
        "There was an error while authenticating, please try again.",
        500
      )
    );
  }

  if (!foundUser) {
    return next(new HttpError("Cannot Sign In. Bad credentials."), 404);
  }

  let isValidPassword = false;
  try {
    isValidPassword = await bcrypt.compare(password, foundUser.passwordHashed);
  } catch (error) {
    return next(
      new HttpError(
        "There was an error while authenticating, please try again.",
        500
      )
    );
  }

  if (!isValidPassword) {
    return next(new HttpError("Cannot Sign In. Bad credentials."), 404);
  }

  let token;
  try {
    token = jwt.sign(
      {
        userId: foundUser.id,
        email: foundUser.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
  } catch (error) {
    return next(new HttpError("Error while signing in, please try again", 404));
  }

  res.json({
    user: {
      id: foundUser.id,
      email: foundUser.email,
      firstName: foundUser.firstName,
      lastName: foundUser.lastName,
      preferredLanguageCode: foundUser.preferredLanguageCode,
      isEmailConfirmed: foundUser.isEmailConfirmed,
      timeZoneId: foundUser.timeZoneId,
      uniqueLinkId: foundUser.uniqueLinkId,
      token: token,
    },
  });
};

const signUp = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new HttpError(
      "Invalid input information. Please check your data.",
      422
    );
  }

  const { email, firstName, lastName, password } = req.body;

  // For now, these values are going to be hard-coded.
  // Eventually they will be entered by the user upon signup.
  let timeZoneId = "615e43c14f1cbd5cd9ae80c2"; // Central Standard Time UTC-6
  let preferredLanguageCode = "es"; // Spanish
  let countryCode = "cr"; // Costa Rica

  let existingUser;
  try {
    existingUser = await User.findOne({ email, isActive: true });
  } catch (error) {
    return next(
      new HttpError(
        "There was an error while finding one user, please try again.",
        500
      )
    );
  }

  if (existingUser) {
    return next(
      new HttpError("User already exists, please try to login instead.", 422)
    );
  }

  let existingTimeZone;
  try {
    existingTimeZone = await TimeZone.findById(timeZoneId);
  } catch (error) {
    return next(
      new HttpError("There was an error while finding a Time Zone.", 404)
    );
  }

  if (!existingTimeZone) {
    return next(
      new HttpError(
        "Provided Time Zone is not valid. Cannot create user with the given information",
        500
      )
    );
  }

  let passwordHashed;
  try {
    passwordHashed = await bcrypt.hash(password, 12);
  } catch (error) {
    return next(
      new HttpError(
        "There was an error while signing up the user, please try again.",
        500
      )
    );
  }

  const newUser = new User({
    email,
    firstName,
    lastName,
    passwordHashed,
    isActive: true,
    preferredLanguageCode,
    isEmailConfirmed: false,
    timeZoneId,
    createdDateTs: new Date().getTime(),
    countryCode,
  });

  newUser.uniqueLinkId = newUser.id.substring(
    newUser.id.length - 7,
    newUser.id.length
  );

  try {
    await newUser.save();
  } catch (error) {
    return next(
      new HttpError("Error while signing up, please try again.", 404)
    );
  }

  let token;
  try {
    token = jwt.sign(
      {
        userId: newUser.id,
        email: newUser.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
  } catch (error) {
    return next(new HttpError("Error while signing up, please try again", 404));
  }

  res.status(201).json({
    user: {
      id: newUser.id,
      email: newUser.email,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      preferredLanguageCode: newUser.preferredLanguageCode,
      isEmailConfirmed: newUser.isEmailConfirmed,
      timeZoneId: newUser.timeZoneId,
      uniqueLinkId: newUser.uniqueLinkId,
      token: token,
    },
  });
};

const getAllUsers = async (req, res, next) => {
  let listOfUsers;

  try {
    listOfUsers = await User.find({}, "-passwordHashed");
  } catch (error) {
    return next(new HttpError("Error while retrieving users.", 404));
  }

  res.json({
    users: listOfUsers.map((user) => user.toObject({ getters: true })),
  });
};

const getUserById = async (req, res, next) => {
  const userId = req.params.uid;

  let foundUser;
  try {
    foundUser = await User.findById(userId);
  } catch (error) {
    return next(
      new HttpError("There was an error while trying to find a user.", 500)
    );
  }

  if (!foundUser) {
    return next(new HttpError("Could not find a user with the given id.", 404));
  }

  res.json({ user: foundUser.toObject({ getters: true }) });
};

const getUserByLinkId = async (req, res, next) => {
  const lid = req.params.lid;

  let foundUser;
  try {
    foundUser = await User.find({ uniqueLinkId: lid });
  } catch (error) {
    return next(
      new HttpError("There was an error while trying to find a user.", 500)
    );
  }

  if (foundUser.length <= 0) {
    return next(
      new HttpError("Could not find a user with the given link id.", 404)
    );
  }

  res.json({ user: foundUser.map((user) => user.toObject({ getters: true })) });
};

const updateUser = (req, res, next) => {
  const { name, lastName } = req.body;

  // TODO: perform the update

  res.status(200).json({ user: req.body });
};

const deleteUser = (req, res, next) => {};

exports.signIn = signIn;
exports.getAllUsers = getAllUsers;
exports.getUserById = getUserById;
exports.gettUserByLinkId = getUserByLinkId;
exports.signUp = signUp;
exports.updateUser = updateUser;
exports.deleteUser = deleteUser;
