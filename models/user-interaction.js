const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

const userInteractionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Types.ObjectId,
    required: true,
    ref: "User",
  },
  type: { type: Number, required: true },
  token: { type: String, required: true },
  expirationDateTs: { type: Number, required: true },
});

userInteractionSchema.plugin(uniqueValidator);

module.exports = mongoose.model("UserInteraction", userInteractionSchema);
