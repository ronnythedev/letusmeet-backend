const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

const timeZoneSchema = new mongoose.Schema({
  abbreviation: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  offSet: { type: Number, required: true },
});

timeZoneSchema.plugin(uniqueValidator);

module.exports = mongoose.model("TimeZone", timeZoneSchema);
