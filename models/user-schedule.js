const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

const userScheduleSchema = new mongoose.Schema({
  weekDay: { type: Number, required: true },
  fromTime: { type: Number, required: true },
  toTime: { type: Number, required: true },
  userId: {
    type: mongoose.Types.ObjectId,
    required: true,
    ref: "User",
  },
});

userScheduleSchema.plugin(uniqueValidator);

module.exports = mongoose.model("UserSchedule", userScheduleSchema);
