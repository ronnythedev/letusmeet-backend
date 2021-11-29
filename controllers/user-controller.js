// third-party packages
const { validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const shortid = require("shortid");
const nodemailer = require("nodemailer");

// models
const User = require("../models/user");
const UserSchedule = require("../models/user-schedule");
const UserInteraction = require("../models/user-interaction");
const Meeting = require("../models/meeting");
const TimeZone = require("../models/timeZone");
const HttpError = require("../models/http-error");

const { startOfWeek, format, addHours } = require("date-fns");

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

  res.status(200).json({
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
    uniqueLinkId: shortid.generate(),
  });

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

  let emailConfirmationToken = shortid.generate();
  const newUserInteraction = new UserInteraction({
    userId: newUser.id,
    type: 1,
    token: emailConfirmationToken,
    expirationDateTs: addHours(new Date(), 24).getTime(),
  });

  try {
    await newUserInteraction.save();
  } catch (error) {
    return next(
      new HttpError("Error while creating email confirmation token", 500)
    );
  }

  let title = `${process.env.APP_NAME} - Confirmación de Email`;
  let paragraph1 = `Hola ${newUser.firstName},`;
  let confirmationLink = `<a href='${process.env.APP_URL}/email-confirm/${emailConfirmationToken}'>${process.env.APP_URL}/email-confirm/${emailConfirmationToken}</a>`;
  let paragraph2 = `Para confirmar tu email por favor haz clic en el siguiente enlance: ${confirmationLink}`;
  let paragraph3 = "Este enlance tiene una validez de 24 horas.";
  let anchor = `<a href='${process.env.APP_URL}'>${process.env.APP_URL_NAME}</a>`;
  let emailBody = `<html><body><h3>${title}</h3><p><span>${paragraph1}</span></p><p><span>${paragraph2}</span></p><p><span>${paragraph3}</span></p><p>${anchor}</p></body></html>`;

  let wasEmailSent = await sendEmail(newUser.email, title, emailBody);

  res.status(201).json({
    user: {
      id: newUser.id,
      email: newUser.email,
      token: token,
    },
    emailSent: wasEmailSent,
  });
};

const getAllUsers = async (req, res, next) => {
  let listOfUsers;

  try {
    listOfUsers = await User.find({}, "-passwordHashed");
  } catch (error) {
    return next(new HttpError("Error while retrieving users.", 404));
  }

  res.status(200).json({
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

  res.status(200).json({
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

  res.status(200).json({
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

// METHODS RELEATED TO USER' SCHEDULE
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

  res.status(200).json({
    availableDates: availableDates.map((date) =>
      date.toObject({ getters: true })
    ),
  });
};

const updateAvailableDatesByUser = async (req, res, next) => {
  const userId = req.userData.uid;
  const newDates = req.body.newDates;

  if (!userId) {
    return next(new HttpError("Authentication Failed.", 403));
  }

  // remove all available dates by user
  const filter = { userId: userId };
  try {
    await UserSchedule.deleteMany(filter);
  } catch (error) {
    return next(
      new HttpError(
        "Error while removing user schedules, please try again.",
        500
      )
    );
  }

  // add the new list of available dates
  await Promise.all(
    newDates.map(async (date) => {
      let values = date.split("-");
      const newSchedule = new UserSchedule({
        weekDay: parseInt(values[0]),
        fromTime: parseInt(values[1]),
        toTime: parseInt(values[2]),
        userId: userId,
      });

      try {
        await newSchedule.save();
      } catch (error) {
        return next(
          new HttpError(
            "Error while saving user schedule entry, please try again.",
            500
          )
        );
      }
    })
  );

  // return the new list of available dates
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

  res.status(200).json({
    availableDates: availableDates.map((date) =>
      date.toObject({ getters: true })
    ),
  });
};

// METHODS RELATED TO MEETINGS
const getUserByLinkId = async (req, res, next) => {
  const lid = req.params.lid;
  let fromDateTs = req.params.fromDateTs;

  // USER INFO
  let foundUser;
  try {
    foundUser = await User.findOne({ uniqueLinkId: lid });
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

  // AVAILABLE DATES BY USER
  let availableDates;
  try {
    availableDates = await UserSchedule.find({ userId: foundUser.id }).sort({
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

  // UPCOMING MEETINGS
  if (fromDateTs == undefined) {
    // if fromDate is not provided, then it will default to the first date of the current week
    fromDateTs = new Date(startOfWeek(new Date())).getTime();
  }

  let upcomingMeetings;
  try {
    upcomingMeetings = await Meeting.find(
      {
        organizerId: foundUser.id,
        startDateTs: { $gt: fromDateTs },
        status: { $in: ["pending", "confirmed"] },
      },
      "startDateTs endDateTs fromTime toTime"
    ).sort({ startDateTs: 1 });
  } catch (error) {
    return next(
      new HttpError(
        "There was an error while trying to get upcoming meetings by user.",
        500
      )
    );
  }

  res.status(200).json({
    user: {
      id: foundUser.id,
      firstName: foundUser.firstName,
      lastName: foundUser.lastName,
      email: foundUser.email,
    },
    availableDates: availableDates.map((date) =>
      date.toObject({ getters: true })
    ),
    upcomingMeetings: upcomingMeetings.map((meeting) =>
      meeting.toObject({ getters: true })
    ),
  });
};

const insertMeetingRequest = async (req, res, next) => {
  const attendeeId = req.userData.uid; // the attendee will be the user making the request
  const { userToId, startDateTs, fromTime, toTime, subject, optionalNotes } =
    req.body;

  if (!attendeeId) {
    return next(new HttpError("Authentication Failed.", 403));
  }

  let attendeeUser;
  try {
    attendeeUser = await User.findById(attendeeId);
  } catch (error) {
    return next(
      new HttpError(
        "There was an error while trying to find attendee user.",
        500
      )
    );
  }

  let organizerUser;
  try {
    organizerUser = await User.findById(userToId);
  } catch (error) {
    return next(
      new HttpError(
        "There was an error while trying to find organizer user.",
        500
      )
    );
  }

  const newMeeting = new Meeting({
    status: "pending",
    startDateTs: startDateTs,
    endDateTs: startDateTs,
    fromTime: fromTime,
    toTime: toTime,
    subject: subject,
    notes: optionalNotes,
    organizerId: userToId,
    attendeeId: attendeeId,
    roomId: shortid.generate(),
    roomPin: String(Math.floor(1000 + Math.random() * 9000)),
  });

  try {
    await newMeeting.save();
  } catch (error) {
    return next(
      new HttpError(
        "Error while saving meeting request. Please try again.",
        500
      )
    );
  }

  let title = "Ha recibido una Solicitud de Reunión";
  let paragraph1 = `${attendeeUser.firstName} ${
    attendeeUser.lastName
  } ha solicitado una reunión con usted para el día ${format(
    parseInt(startDateTs),
    "dd/MMMM/yyyy"
  )}.`;
  let paragraph2 = `Por favor ingrese a la sección de <b>Solicitudes Pendientes</b> de ${process.env.APP_NAME} para confirmarla o declinarla.`;
  let anchor = `<a href='${process.env.APP_URL}'>${process.env.APP_URL_NAME}</a>`;
  let emailBody = `<html><body><h3>${title}</h3><p><span>${paragraph1}</span></p><p><span>${paragraph2}</span></p><p>${anchor}</p></body></html>`;

  let wasEmailSent = await sendEmail(organizerUser.email, title, emailBody);

  res.status(200).json({
    meeting: newMeeting.toObject({ getters: true }),
    emailSent: wasEmailSent,
  });
};

const getUpcomingConfirmedMeetings = async (req, res, next) => {
  const userId = req.userData.uid;
  let fromDateTs = new Date().getTime();

  if (!userId) {
    return next(new HttpError("Authentication Failed.", 403));
  }

  let upcomingMeetings;
  try {
    upcomingMeetings = await Meeting.find(
      {
        $or: [{ organizerId: userId }, { attendeeId: userId }],
        startDateTs: { $gt: fromDateTs },
        status: "confirmed",
      },
      "startDateTs endDateTs fromTime toTime subject notes organizerId attendeeId roomId roomPin"
    ).sort({ startDateTs: 1 });
  } catch (error) {
    return next(
      new HttpError(
        "There was an error while trying to get upcoming meetings by user.",
        500
      )
    );
  }

  const newUpcomingMeetings = await Promise.all(
    upcomingMeetings.map(async (meeting) => {
      let organizer = await User.findById(
        meeting.organizerId,
        "id firstName lastName email"
      );
      let attendee = await User.findById(
        meeting.attendeeId,
        "id firstName lastName email"
      );

      return {
        id: meeting.id,
        startDateTs: meeting.startDateTs,
        endDateTs: meeting.endDateTs,
        fromTime: meeting.fromTime,
        toTime: meeting.toTime,
        subject: meeting.subject,
        notes: meeting.notes,
        roomId: meeting.roomId,
        roomPin: meeting.roomPin,
        organizerId: meeting.organizerId,
        attendee: meeting.attendeeId,
        organizer: organizer,
        attendee: attendee,
      };
    })
  );

  res.status(200).json({
    upcomingMeetings: newUpcomingMeetings,
  });
};

const getUpcomingPendingMeetings = async (req, res, next) => {
  const userId = req.userData.uid;
  let fromDateTs = new Date(startOfWeek(new Date())).getTime();

  if (!userId) {
    return next(new HttpError("Authentication Failed.", 403));
  }

  let upcomingMeetings;
  try {
    upcomingMeetings = await Meeting.find(
      {
        $or: [{ organizerId: userId }, { attendeeId: userId }],
        startDateTs: { $gt: fromDateTs },
        status: "pending",
      },
      "startDateTs endDateTs fromTime toTime subject notes organizerId attendeeId roomId roomPin"
    ).sort({ startDateTs: 1 });
  } catch (error) {
    return next(
      new HttpError(
        "There was an error while trying to get upcoming meetings by user.",
        500
      )
    );
  }

  const newUpcomingMeetings = await Promise.all(
    upcomingMeetings.map(async (meeting) => {
      let organizer = await User.findById(
        meeting.organizerId,
        "id firstName lastName email"
      );
      let attendee = await User.findById(
        meeting.attendeeId,
        "id firstName lastName email"
      );

      return {
        id: meeting.id,
        startDateTs: meeting.startDateTs,
        endDateTs: meeting.endDateTs,
        fromTime: meeting.fromTime,
        toTime: meeting.toTime,
        subject: meeting.subject,
        notes: meeting.notes,
        roomId: meeting.roomId,
        roomPin: meeting.roomPin,
        organizerId: meeting.organizerId,
        attendee: meeting.attendeeId,
        organizer: organizer,
        attendee: attendee,
      };
    })
  );

  res.status(200).json({
    upcomingMeetings: newUpcomingMeetings,
  });
};

const validateMeetingRoomPin = async (req, res, next) => {
  const { roomId, roomPin } = req.params;

  let foundMeeting;
  try {
    foundMeeting = await Meeting.findOne({ roomId: roomId });
  } catch (error) {
    return next(
      new HttpError(
        "There was an error while trying to find a room with the given Id.",
        500
      )
    );
  }

  if (foundMeeting === null || foundMeeting.length <= 0) {
    return next(new HttpError("Could not find a Room with the given Id.", 404));
  }

  if (String(foundMeeting.roomPin) === String(roomPin)) {
    res.status(200).json({ roomPinValid: true });
  } else {
    return next(new HttpError("Entered Room PIN is invalid.", 404));
  }
};

const confirmMeeting = async (req, res, next) => {
  const { meetingId } = req.body;

  try {
    const filter = { _id: meetingId };
    const update = { status: "confirmed" };
    let updatedMeeting = await Meeting.findOneAndUpdate(filter, update, {
      returnOriginal: false,
    });

    let attendeeUser;
    try {
      attendeeUser = await User.findById(updatedMeeting.attendeeId);
    } catch (error) {
      return next(
        new HttpError(
          "There was an error while trying to find attendee user.",
          500
        )
      );
    }

    let organizerUser;
    try {
      organizerUser = await User.findById(updatedMeeting.organizerId);
    } catch (error) {
      return next(
        new HttpError(
          "There was an error while trying to find organizer user.",
          500
        )
      );
    }

    let title = "¡Reunión Confirmada!";
    let paragraph1 = `Su reunión con ${organizerUser.firstName} ${
      organizerUser.lastName
    } para el día ${format(
      parseInt(updatedMeeting.startDateTs),
      "dd/MMMM/yyyy"
    )} ha sido confirmada.`;
    let paragraph2 = `Por favor ingrese a la sección de <b>Próximas Reuniones</b> de ${process.env.APP_NAME} para ver los detalles de ingreso.`;
    let anchor = `<a href='${process.env.APP_URL}'>${process.env.APP_URL_NAME}</a>`;
    let emailBody = `<html><body><h3>${title}</h3><p><span>${paragraph1}</span></p><p><span>${paragraph2}</span></p><p>${anchor}</p></body></html>`;

    let wasEmailSent = await sendEmail(attendeeUser.email, title, emailBody);

    res.status(200).json({ meeting: updatedMeeting, emailSent: wasEmailSent });
  } catch (error) {
    return next(
      new HttpError("There was an error while trying to confirm meeting.", 500)
    );
  }
};

const declineMeeting = async (req, res, next) => {
  const { meetingId } = req.body;

  try {
    const filter = { _id: meetingId };
    const update = { status: "declined" };
    let updatedMeeting = await Meeting.findOneAndUpdate(filter, update, {
      returnOriginal: false,
    });

    let attendeeUser;
    try {
      attendeeUser = await User.findById(updatedMeeting.attendeeId);
    } catch (error) {
      return next(
        new HttpError(
          "There was an error while trying to find attendee user.",
          500
        )
      );
    }

    let organizerUser;
    try {
      organizerUser = await User.findById(updatedMeeting.organizerId);
    } catch (error) {
      return next(
        new HttpError(
          "There was an error while trying to find organizer user.",
          500
        )
      );
    }

    let title = "Reunión Declinada";
    let paragraph1 = `Su solicitud de reunión con ${organizerUser.firstName} ${
      organizerUser.lastName
    } para el día ${format(
      parseInt(updatedMeeting.startDateTs),
      "dd/MMMM/yyyy"
    )} fue declinada.`;
    let paragraph2 = `Por favor ingrese a la sección de <b>Próximas Reuniones</b> de ${process.env.APP_NAME} si desea más detalles.`;
    let anchor = `<a href='${process.env.APP_URL}'>${process.env.APP_URL_NAME}</a>`;
    let emailBody = `<html><body><h3>${title}</h3><p><span>${paragraph1}</span></p><p><span>${paragraph2}</span></p><p>${anchor}</p></body></html>`;

    let wasEmailSent = await sendEmail(attendeeUser.email, title, emailBody);

    res.status(200).json({ meeting: updatedMeeting, emailSent: wasEmailSent });
  } catch (error) {
    return next(
      new HttpError("There was an error while trying to confirm meeting.", 500)
    );
  }
};

const cancelMeeting = async (req, res, next) => {
  const { meetingId } = req.body;

  try {
    const filter = { _id: meetingId };
    const update = { status: "canceled" };
    let updatedMeeting = await Meeting.findOneAndUpdate(filter, update, {
      returnOriginal: false,
    });

    let attendeeUser;
    try {
      attendeeUser = await User.findById(updatedMeeting.attendeeId);
    } catch (error) {
      return next(
        new HttpError(
          "There was an error while trying to find attendee user.",
          500
        )
      );
    }

    let organizerUser;
    try {
      organizerUser = await User.findById(updatedMeeting.organizerId);
    } catch (error) {
      return next(
        new HttpError(
          "There was an error while trying to find organizer user.",
          500
        )
      );
    }

    let title = "Reunión Cancelada";
    let paragraph1 = `${attendeeUser.firstName} ${
      attendeeUser.lastName
    } canceló la solicitud de reunión del día ${format(
      parseInt(updatedMeeting.startDateTs),
      "dd/MMMM/yyyy"
    )}.`;
    let paragraph2 = `El horario de esta reunión en su calendario ya fue liberado. No se requieren más acciones de su parte.`;
    let anchor = `<a href='${process.env.APP_URL}'>${process.env.APP_URL_NAME}</a>`;
    let emailBody = `<html><body><h3>${title}</h3><p><span>${paragraph1}</span></p><p><span>${paragraph2}</span></p><p>${anchor}</p></body></html>`;

    let wasEmailSent = await sendEmail(organizerUser.email, title, emailBody);

    res.status(200).json({ meeting: updatedMeeting, emailSent: wasEmailSent });
  } catch (error) {
    return next(
      new HttpError("There was an error while trying to confirm meeting.", 500)
    );
  }
};

// METHODS RELATED TO USER INTERACTION: EMAIL CONFIRMATION, PASSWORD RESET...
const resendConfirmationEmail = async (req, res, next) => {
  const userId = req.userData.uid;

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

  let emailConfirmationToken = shortid.generate();
  const newUserInteraction = new UserInteraction({
    userId: foundUser.id,
    type: 1,
    token: emailConfirmationToken,
    expirationDateTs: addHours(new Date(), 24).getTime(),
  });

  try {
    await newUserInteraction.save();
  } catch (error) {
    return next(
      new HttpError("Error while creating email confirmation token", 500)
    );
  }

  let title = `${process.env.APP_NAME} - Confirmación de Email`;
  let paragraph1 = `Hola ${foundUser.firstName},`;
  let confirmationLink = `<a href='${process.env.APP_URL}/email-confirm/${emailConfirmationToken}'>${process.env.APP_URL}/email-confirm/${emailConfirmationToken}</a>`;
  let paragraph2 = `Para confirmar tu email por favor haz clic en el siguiente enlance: ${confirmationLink}`;
  let paragraph3 = "Este enlance tiene una validez de 24 horas.";
  let anchor = `<a href='${process.env.APP_URL}'>${process.env.APP_URL_NAME}</a>`;
  let emailBody = `<html><body><h3>${title}</h3><p><span>${paragraph1}</span></p><p><span>${paragraph2}</span></p><p><span>${paragraph3}</span></p><p>${anchor}</p></body></html>`;

  let wasEmailSent = await sendEmail(foundUser.email, title, emailBody);

  if (wasEmailSent) {
    res.status(201).json({
      emailSent: wasEmailSent,
    });
  } else {
    return next(new HttpError("Error sending confirmation email", 500));
  }
};

const confirmEmail = async (req, res, next) => {
  const { token } = req.params;

  let foundInteraction;
  try {
    foundInteraction = await UserInteraction.findOne({ token: token, type: 1 });
  } catch (error) {
    return next(
      new HttpError("Could not find information with the given token.", 404)
    );
  }

  if (
    foundInteraction === undefined ||
    foundInteraction === null ||
    foundInteraction.length <= 0
  ) {
    return next(
      new HttpError("Could not find information with the given token.", 404)
    );
  }

  if (foundInteraction.expirationDateTs < new Date().getTime()) {
    return next(new HttpError("Token has expired.", 410));
  }

  let foundUser;
  try {
    foundUser = await User.findById(foundInteraction.userId);
  } catch (error) {
    return next(new HttpError("Could not find associated user.", 500));
  }

  if (foundUser === undefined || foundUser === null || foundUser.length <= 0) {
    return next(new HttpError("Could not find associated user.", 500));
  }

  try {
    const filter = { _id: foundUser.id };
    const update = { isEmailConfirmed: true };
    let updatedUser = await User.findOneAndUpdate(filter, update, {
      returnOriginal: false,
    });
    res.status(200).json({ emailConfirmed: true });
  } catch (error) {
    return next(new HttpError("Could not confirm email.", 500));
  }
};

const sendPasswordResetEmail = async (req, res, next) => {
  const { email } = req.params;

  let foundUser;
  try {
    foundUser = await User.findOne({ email: email });
  } catch (error) {
    return next(
      new HttpError("There was an error while trying to find a user.", 500)
    );
  }

  if (!foundUser) {
    return next(
      new HttpError("Could not find a user with the given email.", 404)
    );
  }

  let passwordResetToken = shortid.generate();
  const newUserInteraction = new UserInteraction({
    userId: foundUser.id,
    type: 2,
    token: passwordResetToken,
    expirationDateTs: addHours(new Date(), 24).getTime(),
  });

  try {
    await newUserInteraction.save();
  } catch (error) {
    return next(
      new HttpError("Error while creating password reset token", 500)
    );
  }

  let title = `${process.env.APP_NAME} - Restablecer Contraseña`;
  let paragraph1 = `Hola ${foundUser.firstName},`;
  let passwordResetLink = `<a href='${process.env.APP_URL}/auth/changepass?token=${passwordResetToken}'>${process.env.APP_URL}/auth/changepass?token=${passwordResetToken}</a>`;
  let paragraph2 = `Para restablecer tu contraseña por favor haz clic en el siguiente enlance: ${passwordResetLink}. Este enlance tiene una validez de 24 horas.`;
  let paragraph3 =
    "Si no solicitaste restablecer tu contraseña, puedes ignorar este mensaje.";
  let anchor = `<a href='${process.env.APP_URL}'>${process.env.APP_URL_NAME}</a>`;
  let emailBody = `<html><body><h3>${title}</h3><p><span>${paragraph1}</span></p><p><span>${paragraph2}</span></p><p><span>${paragraph3}</span></p><p>${anchor}</p></body></html>`;

  let wasEmailSent = await sendEmail(foundUser.email, title, emailBody);

  if (wasEmailSent) {
    res.status(200).json({
      emailSent: wasEmailSent,
    });
  } else {
    return next(new HttpError("Error sending confirmation email", 500));
  }
};

const confirmPasswordReset = async (req, res, next) => {
  const { token, newPassword } = req.params;

  if (token === undefined || newPassword === undefined) {
    return next(new HttpError("Bad request.", 400));
  }

  let foundInteraction;
  try {
    foundInteraction = await UserInteraction.findOne({ token: token, type: 2 });
  } catch (error) {
    return next(
      new HttpError("Could not find information with the given token.", 404)
    );
  }

  if (
    foundInteraction === undefined ||
    foundInteraction === null ||
    foundInteraction.length <= 0
  ) {
    return next(
      new HttpError("Could not find information with the given token.", 404)
    );
  }

  if (foundInteraction.expirationDateTs < new Date().getTime()) {
    return next(new HttpError("Token has expired.", 410));
  }

  let foundUser;
  try {
    foundUser = await User.findById(foundInteraction.userId);
  } catch (error) {
    return next(new HttpError("Could not find associated user.", 404));
  }

  if (foundUser === undefined || foundUser === null || foundUser.length <= 0) {
    return next(new HttpError("Could not find associated user.", 404));
  }

  let passwordHashed;
  try {
    passwordHashed = await bcrypt.hash(newPassword, 12);
  } catch (error) {
    return next(
      new HttpError("There was an error while hashing password.", 500)
    );
  }

  try {
    const filter = { _id: foundUser.id };
    const update = { passwordHashed: passwordHashed };
    let updatedUser = await User.findOneAndUpdate(filter, update, {
      returnOriginal: false,
    });
    res.status(200).json({ userUpdatedId: foundUser._id });
  } catch (error) {
    return next(new HttpError("Could not update password.", 500));
  }
};

const passwordUpdate = async (req, res, next) => {
  const userId = req.userData.uid;
  const { newPassword } = req.params;

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

  let passwordHashed;
  try {
    passwordHashed = await bcrypt.hash(newPassword, 12);
  } catch (error) {
    return next(
      new HttpError("There was an error while hashing password.", 500)
    );
  }

  try {
    const filter = { _id: foundUser.id };
    const update = { passwordHashed: passwordHashed };
    let updatedUser = await User.findOneAndUpdate(filter, update, {
      returnOriginal: false,
    });
    res.status(200).json({ userUpdatedId: foundUser._id });
  } catch (error) {
    return next(new HttpError("Could not update password.", 500));
  }
};

const sendEmail = async (toMail, subject, bodyInHtml) => {
  let fromEmail;

  let transporter;
  if (process.env.EMAIL_METHOD === "SMTP") {
    fromEmail = process.env.SMTP_FromEmail;
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_Host,
      port: process.env.SMTP_Port,
      secure: process.env.SMTP_IsSecure,
      auth: {
        user: process.env.SMTP_Username,
        pass: process.env.SMTP_Password,
      },
    });
  } else if (process.env.EMAIL_METHOD === "service") {
    fromEmail = process.env.EMAIL_Username;
    transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE,
      auth: {
        user: process.env.EMAIL_Username,
        pass: process.env.EMAIL_Password,
      },
    });
  }

  try {
    let info = await transporter.sendMail({
      from: fromEmail,
      to: toMail,
      subject: subject,
      html: bodyInHtml,
    });
    if (info.messageId !== "") {
      return true;
    }
  } catch (error) {
    console.log("Error sending email: ", error);
    return false;
  }
};

// NOT  IMPLEMENTED YET
const deleteUser = (req, res, next) => {};

const updateUser = (req, res, next) => {
  const { name, lastName } = req.body;

  // TODO: perform the update

  res.status(200).json({ user: req.body });
};

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
exports.updateAvailableDatesByUser = updateAvailableDatesByUser;
exports.insertMeetingRequest = insertMeetingRequest;
exports.getUpcomingConfirmedMeetings = getUpcomingConfirmedMeetings;
exports.getUpcomingPendingMeetings = getUpcomingPendingMeetings;
exports.validateMeetingRoomPin = validateMeetingRoomPin;
exports.confirmMeeting = confirmMeeting;
exports.declineMeeting = declineMeeting;
exports.cancelMeeting = cancelMeeting;
exports.resendConfirmationEmail = resendConfirmationEmail;
exports.confirmEmail = confirmEmail;
exports.sendPasswordResetEmail = sendPasswordResetEmail;
exports.confirmPasswordReset = confirmPasswordReset;
exports.passwordUpdate = passwordUpdate;
