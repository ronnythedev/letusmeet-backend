const express = require("express");
const { check } = require("express-validator");

const timeZoneController = require("../controllers/timeZone-controller");

const router = express.Router();

router.get("/all", timeZoneController.getAllTimeZones);

router.get("/:tzid", timeZoneController.getTimeZoneById);

module.exports = router;
