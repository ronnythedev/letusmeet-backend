const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  passwordHashed: { type: String, required: true },
  uniqueLinkId: { type: String, required: true, unique: true },
  imageUrl: { type: String, required: false, defualt: "" },
  isActive: { type: Boolean, required: true, default: true },
  preferredLanguageCode: { type: String, required: true },
  isEmailConfirmed: { type: Boolean, required: false, default: false },
  timeZoneId: {
    type: mongoose.Types.ObjectId,
    required: true,
    ref: "TimeZone",
  },
  createdDateTs: { type: Number, required: true },
  countryCode: { trype: String, required: false },
});

userSchema.plugin(uniqueValidator);

module.exports = mongoose.model("User", userSchema);
