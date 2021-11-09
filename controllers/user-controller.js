// third-party packages
const { validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// models
const User = require("../models/user");
const UserSchedule = require("../models/user-schedule");
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
    return next(new HttpError("Cannot Sign In. Invalid credentials."), 403);
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
    return next(new HttpError("Cannot Sign In. Invalid credentials."), 403);
  }

  let token;
  try {
    token = jwt.sign(
      {
        uid: foundUser.id,
        email: foundUser.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
  } catch (error) {
    return next(new HttpError("Error while signing in, please try again", 500));
  }

  res.json({
    user: {
      id: foundUser.id,
      email: foundUser.email,
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
      new HttpError("There was an error while finding a Time Zone.", 500)
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
      new HttpError("Error while signing up, please try again.", 500)
    );
  }

  let token;
  try {
    token = jwt.sign(
      {
        uid: newUser.id,
        email: newUser.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
  } catch (error) {
    return next(new HttpError("Error while signing up, please try again", 500));
  }

  res.status(201).json({
    user: {
      id: newUser.id,
      email: newUser.email,
      token: token,
    },
  });
};

const getAvailableDates = async (req, res, next) => {
  const userId = req.userData.uid;

  if (!userId) {
    return next(new HttpError("Authentication Failed.", 403));
  }

  let availableDates;
  try {
    availableDates = await UserSchedule.find({ userId: userId }).sort({
      weekDay: 1,
      toTime: 1,
    });
  } catch (error) {
    return next(
      new HttpError(
        "There was an error while trying to get available dates by user.",
        500
      )
    );
  }

  res.json({
    availableDates: availableDates.map((date) =>
      date.toObject({ getters: true })
    ),
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
    },
  });
};

const getAuthUser = async (req, res, next) => {
  const userId = req.userData.uid;

  if (!userId) {
    return next(new HttpError("Authentication Failed.", 403));
  }

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
    },
  });
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

const updateUniqueLinkId = async (req, res, next) => {
  const newLink = req.body.newLink;
  const userId = req.userData.uid;

  let foundUser;
  try {
    foundUser = await User.find({ uniqueLinkId: newLink });
  } catch (error) {
    return next(
      new HttpError(
        "There was an error while trying to find a user by link.",
        500
      )
    );
  }

  if (foundUser.length <= 0) {
    try {
      const filter = { _id: userId };
      const update = { uniqueLinkId: newLink };
      let updatedUser = await User.findOneAndUpdate(filter, update, {
        returnOriginal: false,
      });
      res.status(200).json({ user: updatedUser });
    } catch (error) {
      return next(
        new HttpError(
          "There was an error while trying to find a user by id.",
          500
        )
      );
    }
  } else if (foundUser.length === 1) {
    if (foundUser[0].id === userId) {
      res.status(200).json({ user: foundUser[0] }); // if it's the same user, is not necessary to save
    } else {
      return next(
        new HttpError("The given link is being used by another user.", 500)
      );
    }
  } else {
    return next(
      new HttpError("The given link is being used by another user", 500)
    );
  }
};

const deleteUser = (req, res, next) => {};

exports.signIn = signIn;
exports.getAllUsers = getAllUsers;
exports.getUserById = getUserById;
exports.getAuthUser = getAuthUser;
exports.getUserByLinkId = getUserByLinkId;
exports.signUp = signUp;
exports.updateUser = updateUser;
exports.updateUniqueLinkId = updateUniqueLinkId;
exports.deleteUser = deleteUser;
exports.getAvailableDates = getAvailableDates;
