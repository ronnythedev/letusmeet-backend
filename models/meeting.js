const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

const meetingSchema = new mongoose.Schema({
  status: { type: String, required: true },
  startDateTs: { type: Number, required: true },
  endDateTs: { type: Number, required: true },
  fromTime: { type: Number, required: true },
  toTime: { type: Number, required: true },
  subject: { type: String, required: true },
  notes: { type: String },
  organizerId: {
    type: mongoose.Types.ObjectId,
    required: true,
    ref: "User",
  },
  attendeeId: {
    type: mongoose.Types.ObjectId,
    required: true,
    ref: "User",
  },
  roomId: { type: String, required: true, unique: true },
  roomPin: { type: String, required: true },
});

meetingSchema.plugin(uniqueValidator);

module.exports = mongoose.model("Meeting", meetingSchema);
