const express = require("express");
const { check } = require("express-validator");

const userController = require("../controllers/user-controller");
const checkAuth = require("../middleware/check-auth");

const router = express.Router();

router.post(
  "/signin",
  [
    check("email").notEmpty(),
    check("email").isEmail(),
    check("password").notEmpty(),
    check("password").isLength({ min: 6 }),
  ],
  userController.signIn
);

router.post(
  "/signup",
  [
    check("firstName").notEmpty(),
    check("lastName").notEmpty(),
    check("email").isEmail(),
    check("password").isLength({ min: 6 }),
  ],
  userController.signUp
);

router.get("/link/:lid/:fromDateTs", userController.getUserByLinkId);

//*****
//*****
// ALL ROUTES BELOW THIS MIDDLEWARE WILL NEED AUTHENTICATION
router.use(checkAuth);

router.post("/insert-meeting-request", userController.insertMeetingRequest);

router.get("/available-dates", userController.getAvailableDates);

router.get("/upcoming-meetings", userController.getUpcomingConfirmedMeetings);

router.get(
  "/upcoming-pending-meetings",
  userController.getUpcomingPendingMeetings
);

router.patch("/confirm-meeting", userController.confirmMeeting);

router.patch("/decline-meeting", userController.declineMeeting);

router.patch("/update-dates", userController.updateAvailableDatesByUser);

router.get(
  "/validate-room-pin/:roomId/:roomPin",
  userController.validateMeetingRoomPin
);

router.get("/all", userController.getAllUsers); // this route might also need some sort of special role

router.patch("/updatelink", userController.updateUniqueLinkId);

router.patch("/:uid", userController.updateUser);

router.get("/:uid", userController.getUserById);

router.get("/", userController.getAuthUser);

module.exports = router;
