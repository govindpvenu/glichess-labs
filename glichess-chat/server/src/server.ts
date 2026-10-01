import "dotenv/config";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { app } from "./app.js";
import { registerChatSocket } from "./socket/chatSocket.js";

const port = Number(process.env.PORT ?? 3000);
const origin = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin } });

registerChatSocket(io);

httpServer.listen(port, () => {
  console.log(`Chat server listening on http://localhost:${port}`);
});
