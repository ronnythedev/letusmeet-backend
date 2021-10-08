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

// ALL ROUTES BELOW THIS MIDDLEWARE WILL NEED AUTHENTICATION
router.use(checkAuth);

router.get("/all", userController.getAllUsers); // this route might also need some sort of special role

router.get("/link/:lid", userController.gettUserByLinkId);

router.patch("/link/:newlink", userController.updateUniqueLinkId);

router.patch("/:uid", userController.updateUser);

router.get("/:uid", userController.getUserById);

router.get("/", userController.getAuthUser);

module.exports = router;
