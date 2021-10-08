const express = require("express");
const { check } = require("express-validator");

const userController = require("../controllers/user-controller");

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

router.get("/all", userController.getAllUsers);

router.get("/:uid", userController.getUserById);

router.get("/link/:lid", userController.gettUserByLinkId);

router.patch("/:uid", userController.updateUser);

module.exports = router;
