import { randomUUID } from "node:crypto";
import type { Server } from "socket.io";
import type { ChatMessage, JoinPayload, LeavePayload, SendPayload } from "../types/chat.js";

const MAX_TEXT_LENGTH = 300;
const MAX_MESSAGES_PER_GAME = 100;
const MAX_CACHED_GAMES = 100;
const histories = new Map<string, ChatMessage[]>();

const roomFor = (gameId: string) => `game:${gameId}`;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isNonEmptyString = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.trim().length <= max;

function validJoin(value: unknown): value is JoinPayload {
  return isRecord(value) &&
    isNonEmptyString(value.gameId, 80) &&
    isNonEmptyString(value.playerId, 80) &&
    isNonEmptyString(value.playerName, 40);
}

function trimCache(io: Server): void {
  if (histories.size <= MAX_CACHED_GAMES) return;
  for (const gameId of histories.keys()) {
    if (!io.sockets.adapter.rooms.has(roomFor(gameId))) histories.delete(gameId);
    if (histories.size <= MAX_CACHED_GAMES) break;
  }
  // If every room is active, cap memory by dropping the oldest history anyway.
  while (histories.size > MAX_CACHED_GAMES) {
    const oldest = histories.keys().next().value;
    if (oldest === undefined) break;
    histories.delete(oldest);
  }
}

export function registerChatSocket(io: Server): void {
  io.on("connection", (socket) => {
    let current: JoinPayload | null = null;

    socket.on("game:join", (payload: unknown) => {
      if (!validJoin(payload)) {
        socket.emit("chat:error", { message: "Enter a valid game ID and player." });
        return;
      }

      const next: JoinPayload = {
        gameId: payload.gameId.trim(),
        playerId: payload.playerId.trim(),
        playerName: payload.playerName.trim(),
      };
      if (current) socket.leave(roomFor(current.gameId));
      current = next;
      socket.join(roomFor(next.gameId));

      // A reconnecting client receives the current, bounded game history.
      const history = histories.get(next.gameId) ?? [];
      socket.emit("chat:history", [...history]);
    });

    socket.on("game:leave", (payload: unknown) => {
      if (!isRecord(payload) || !isNonEmptyString(payload.gameId, 80) ||
          !isNonEmptyString(payload.playerId, 80)) {
        socket.emit("chat:error", { message: "Invalid leave request." });
        return;
      }
      if (!current || current.gameId !== payload.gameId.trim() ||
          current.playerId !== payload.playerId.trim()) {
        socket.emit("chat:error", { message: "You are not in that game." });
        return;
      }
      socket.leave(roomFor(current.gameId));
      current = null;
    });

    socket.on("chat:send", (payload: unknown) => {
      if (!isRecord(payload) || !validJoin(payload) || typeof payload.text !== "string") {
        socket.emit("chat:error", { message: "Invalid message details." });
        return;
      }
      const text = payload.text.trim();
      if (!text) {
        socket.emit("chat:error", { message: "Write a message before sending." });
        return;
      }
      if (text.length > MAX_TEXT_LENGTH) {
        socket.emit("chat:error", { message: `Messages must be ${MAX_TEXT_LENGTH} characters or fewer.` });
        return;
      }
      if (!current || current.gameId !== payload.gameId.trim() ||
          current.playerId !== payload.playerId.trim() ||
          current.playerName !== payload.playerName.trim()) {
        socket.emit("chat:error", { message: "Join this game before sending a message." });
        return;
      }

      const message: ChatMessage = {
        id: randomUUID(),
        gameId: current.gameId,
        playerId: current.playerId,
        playerName: current.playerName,
        text,
        timestamp: Date.now(),
      };
      const history = histories.get(current.gameId) ?? [];
      history.push(message);
      if (history.length > MAX_MESSAGES_PER_GAME) history.shift();
      // Refresh insertion order so inactive, least recently used games are evicted first.
      histories.delete(current.gameId);
      histories.set(current.gameId, history);
      trimCache(io);
      io.to(roomFor(current.gameId)).emit("chat:message", message);
    });

    socket.on("disconnect", () => {
      current = null;
      trimCache(io);
    });
  });
}
