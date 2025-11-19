
// server/server.js
import "dotenv/config";
import express from "express";
import http from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import cors from "cors";

// use your helpers from auth.js
import {
  hashPassword,
  verifyPassword,
  signToken,
  requireAuth,
} from "./auth.js";

const {
  PORT = 5000,
  MONGODB_URI,
  JWT_SECRET = "change_me", // used by auth.js too
} = process.env;

if (!MONGODB_URI) {
  console.error("Missing MONGODB_URI in env");
  process.exit(1);
}

const app = express();
const server = http.createServer(app);

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());

/*  MongoDB connect  */
mongoose.set("strictQuery", true);
mongoose
  .connect(MONGODB_URI, { maxPoolSize: 10 })
  .then(() => console.log(" MongoDB connected"))
  .catch((err) => {
    console.error(" MongoDB connection error:", err);
    process.exit(1);
  });

/*  Models*/
const { Schema, model } = mongoose;

const userSchema = new Schema(
  {
    username: {
      type: String,
      unique: true,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 24,
    },
    email: { type: String, unique: true, sparse: true, trim: true },
    password: { type: String, required: true }, // bcrypt hash
  },
  { timestamps: true }
);
const User = model("User", userSchema);

const messageSchema = new Schema(
  {
    room: { type: String, index: true, required: true },
    username: { type: String, required: true },
    text: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
messageSchema.index({ room: 1, createdAt: -1 });
const Message = model("Message", messageSchema);

/* Routes */
app.get("/health", (_req, res) => res.json({ ok: true }));

// Register
app.post("/auth/register", async (req, res) => {
  try {
    const { username, password, email } = req.body || {};
    if (!username || !password)
      return res.status(400).json({ error: "Username and password required" });

    const exists = await User.findOne({ username });
    if (exists) return res.status(409).json({ error: "Username already taken" });

    const hashed = await hashPassword(password);
    const user = await User.create({ username, email, password: hashed });

    const token = signToken({ id: user._id, username: user.username });
    res.json({
      token,
      user: { id: user._id, username: user.username, email: user.email },
    });
  } catch (e) {
    console.error("Register error:", e);
    res.status(500).json({ error: "Registration failed" });
  }
});

// Login
app.post("/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password)
      return res.status(400).json({ error: "Username and password required" });

    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await verifyPassword(password, user.password);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const token = signToken({ id: user._id, username: user.username });
    res.json({
      token,
      user: { id: user._id, username: user.username, email: user.email },
    });
  } catch (e) {
    console.error("Login error:", e);
    res.status(500).json({ error: "Login failed" });
  }
});

// Guest login
app.post("/auth/guest", async (req, res) => {
  try {
    const username = (req.body?.username || "").trim();
    if (!username || username.length < 3)
      return res.status(400).json({ error: "username required" });
    const token = signToken({ id: `guest:${username}`, username }, "7d");
    res.json({ token, user: { id: `guest:${username}`, username } });
  } catch (e) {
    console.error("Guest error:", e);
    res.status(500).json({ error: "guest failed" });
  }
});

// Get room history (REST)
app.get("/rooms/:room/messages", requireAuth, async (req, res) => {
  const { room } = req.params;
  const limit = Math.min(parseInt(req.query.limit || "50", 10), 200);
  const docs = await Message.find({ room })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  res.json(docs.reverse());
});

/*  Dynamic Rooms */
let rooms = ["main", "chil", "work", "fun"];
let onlineUsers = {}; // { room: [username] }

app.get("/rooms", (req, res) => {
  res.json(rooms);
});

app.post("/rooms", (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Room name required" });
  if (rooms.includes(name))
    return res.status(400).json({ error: "Room already exists" });

  rooms.push(name);
  onlineUsers[name] = [];
  io.emit("roomsUpdated", rooms);
  res.json({ success: true, rooms });
});


//  NEW: DELETE ROOM (NO LOGIC CHANGED)
app.delete("/rooms/:name", (req, res) => {
  const roomName = req.params.name;

  // Default rooms ko delete nahi hone dena
  const protectedRooms = ["general", "random", "tech", "music"];

  if (protectedRooms.includes(roomName)) {
    return res.status(400).json({ error: "Default rooms cannot be deleted" });
  }

  // Room not found
  if (!rooms.includes(roomName)) {
    return res.status(404).json({ error: "Room not found" });
  }

  // Array me se remove
  rooms = rooms.filter((r) => r !== roomName);

  // Online users clean
  if (onlineUsers[roomName]) {
    delete onlineUsers[roomName];
  }

  // Sabko update bhejo
  io.emit("roomsUpdated", rooms);

  return res.json({ success: true, rooms });
});


/* Socket.io */
const io = new Server(server, {
  cors: { origin: true, credentials: true, methods: ["GET", "POST"] },
});

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Join Room
  socket.on("joinRoom", async ({ room, username }) => {
    socket.join(room);
    socket.username = username;
    socket.room = room;

    // Load last 50 msgs from DB
    const history = await Message.find({ room })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    socket.emit("chatHistory", history.reverse());

    // Add to online users
    if (!onlineUsers[room]) onlineUsers[room] = [];
    if (!onlineUsers[room].includes(username))
      onlineUsers[room].push(username);

    io.to(room).emit("onlineUsers", onlineUsers[room]);
  });

  // Create Room via socket
  socket.on('createRoom', (name, cb) => {
    try {
      const n = (name || '').trim();
      if (!n) return cb && cb({ error: 'Room name required' });
      if (rooms.includes(n)) return cb && cb({ error: 'Room already exists' });
      rooms.push(n);
      onlineUsers[n] = [];
      io.emit('roomsUpdated', rooms);
      return cb && cb({ success: true, rooms });
    } catch (e) {
      console.error('createRoom socket error', e);
      return cb && cb({ error: 'Create room failed' });
    }
  });

  // Chat Message
  socket.on("chatMessage", async ({ room, username, text }) => {
    if (!room || !username || !text) return;
    const msg = await Message.create({ room, username, text });
    io.to(room).emit("chatMessage", {
      username,
      text,
      createdAt: msg.createdAt,
    });
  });

  // Typing indicator
  socket.on("typing", ({ room, username, isTyping }) => {
    socket.to(room).emit("typing", { username, isTyping });
  });

  // Disconnect
  socket.on("disconnect", () => {
    const { room, username } = socket;
    if (room && onlineUsers[room]) {
      onlineUsers[room] = onlineUsers[room].filter((u) => u !== username);
      io.to(room).emit("onlineUsers", onlineUsers[room]);
    }
    console.log(" Client disconnected:", socket.id);
  });
});

app.get("/", (_req, res) => {
  res.send(" Realtime Chat Server running!");
});

server.listen(PORT, () => {
  console.log(` Server running on port ${PORT}`);
});
