import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.CLIENT_ORIGIN || "*" },
});

app.get("/health", (_request, response) => response.json({ ok: true }));

io.on("connection", (socket) => {
  let roomId = null;

  function leaveRoom() {
    if (!roomId) return;
    socket.to(roomId).emit("peer-left");
    socket.leave(roomId);
    roomId = null;
  }

  socket.on("join-room", (requestedRoom, reply) => {
    if (typeof reply !== "function") return;
    const room = typeof requestedRoom === "string" ? requestedRoom.trim() : "";
    if (!room || room.length > 80) {
      reply({ ok: false, error: "Enter a room ID (up to 80 characters)." });
      return;
    }
    if (roomId) {
      reply({ ok: false, error: "Leave your current room first." });
      return;
    }

    const peers = io.sockets.adapter.rooms.get(room);
    const count = peers?.size || 0;
    if (count >= 2) {
      reply({ ok: false, error: "Room is full." });
      return;
    }

    roomId = room;
    socket.join(room);
    reply({ ok: true, role: count === 0 ? "first" : "second" });
    if (count === 1) socket.to(room).emit("peer-joined");
    console.log(`[Signaling] ${socket.id} joined ${room} (${count + 1}/2)`);
  });

  for (const event of ["offer", "answer", "ice-candidate"]) {
    socket.on(event, (payload) => {
      if (!roomId) return;
      socket.to(roomId).emit(event, payload);
    });
  }

  socket.on("leave-room", leaveRoom);
  socket.on("disconnect", leaveRoom);
});

const port = Number(process.env.PORT) || 3000;
httpServer.listen(port, "0.0.0.0", () => {
  console.log(`Signaling server listening on port ${port}`);
});
