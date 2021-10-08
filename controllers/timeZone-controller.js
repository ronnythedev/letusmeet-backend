// third-party packages
const { validationResult } = require("express-validator");

// models
const TimeZone = require("../models/timeZone");
const HttpError = require("../models/http-error");

const getAllTimeZones = async (req, res, next) => {
  let listOfTimeZones;

  try {
    listOfTimeZones = await TimeZone.find();
  } catch (error) {
    return next(new HttpError("Error while retrieving Time Zones.", 404));
  }

  res.json({
    timeZones: listOfTimeZones.map((tz) => tz.toObject({ getters: true })),
  });
};

const getTimeZoneById = async (req, res, next) => {
  const tzid = req.params.tzid;

  let foundTimeZone;
  try {
    foundTimeZone = await TimeZone.findById(tzid);
  } catch (error) {
    return next(
      new HttpError("There was an error while trying to find a Time Zone.", 500)
    );
  }

  if (!foundTimeZone) {
    return next(
      new HttpError("Could not find a Time Zone with the given id.", 404)
    );
  }

  res.json({ timeZone: foundTimeZone.toObject({ getters: true }) });
};

exports.getAllTimeZones = getAllTimeZones;
exports.getTimeZoneById = getTimeZoneById;
