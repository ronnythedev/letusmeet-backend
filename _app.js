require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const http = require("http");
const mongoConnectionString = process.env.MONGO_CONNECTION_STRING;

const HttpError = require("./models/http-error");

const authRoutes = require("./routes/auth-routes");
const userRoutes = require("./routes/user-routes");
const timeZoneRoutes = require("./routes/timeZone-routes");
const meetingRoutes = require("./routes/meeting-routes");
const meetingRoomRoutes = require("./routes/meeting-room-routes");

// create server
const app = express();
const server = http.createServer(app);
const socket = require("socket.io");
const io = socket(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const users = {};
const socketToRoom = {};

// parse application/json
app.use(express.json());

app.use(express.urlencoded({ extended: true }));

// set CORS
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE");
  next();
});

io.on("connection", (socket) => {
  socket.on("join room", (roomID) => {
    if (users[roomID]) {
      const length = users[roomID].length;

      if (length === 2) {
        socket.emit("room full");
        return;
      }
      users[roomID].push(socket.id);
    } else {
      users[roomID] = [socket.id];
    }
    socketToRoom[socket.id] = roomID;

    const usersInThisRoom = users[roomID].filter((id) => id !== socket.id);

    socket.emit("all users", usersInThisRoom);
  });

  socket.on("sending signal", (payload) => {
    io.to(payload.userToSignal).emit("user joined", {
      signal: payload.signal,
      callerID: payload.callerID,
    });
  });

  socket.on("returning signal", (payload) => {
    io.to(payload.callerID).emit("receiving returned signal", {
      signal: payload.signal,
      id: socket.id,
    });
  });

  socket.on("disconnect", () => {
    const roomID = socketToRoom[socket.id];
    let room = users[roomID];
    if (room) {
      room = room.filter((id) => id !== socket.id);
      users[roomID] = room;
    }
  });
});

// add middleware routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/timezone", timeZoneRoutes);
app.use("/api/meeting", meetingRoutes);
app.use("/api/meetingRoom", meetingRoomRoutes);

// Handle not existing routes
app.use((req, res, next) => {
  const error = new HttpError("Could not find this route.", 404);
  return next(error);
});

// Handle errors
app.use((error, req, res, next) => {
  if (res.headerSent) {
    return next(error);
  }
  res.status(error.code || 500);
  res.json({
    message: error.message || "Unknown error occurred.",
    status: "error",
    code: error.code || 500,
  });
});

// start the server if connection to database is successful
mongoose
  .connect(mongoConnectionString)
  .then(() => {
    server.listen(process.env.PORT || 5000);
  })
  .catch((error) => {
    console.log(error);
  });
