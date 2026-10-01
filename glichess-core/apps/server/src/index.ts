import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { Chess, type Square } from 'chess.js';
import express from 'express';
import { Server, type Socket } from 'socket.io';
import type { ClientToServerEvents, GameResult, GameState, MoveIntent, PlayerColor, ServerToClientEvents } from '@chess/shared';

type Game = { id: string; whitePlayerId: string; blackPlayerId: string | null; chess: Chess; result: GameResult | null };
const games = new Map<string, Game>();
const app = express();
const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173' },
});
app.get('/health', (_request, response) => response.json({ ok: true }));
const room = (gameId: string) => `game:${gameId}`;

function state(game: Game): GameState {
  const chess = game.chess;
  let result = game.result;
  if (!result && chess.isCheckmate()) result = { reason: 'checkmate', winner: chess.turn() === 'w' ? 'black' : 'white' };
  else if (!result && chess.isStalemate()) result = { reason: 'stalemate', winner: null };
  else if (!result && chess.isDraw()) result = { reason: 'draw', winner: null };
  return {
    gameId: game.id, fen: chess.fen(), turn: chess.turn(),
    status: result ? 'finished' : game.blackPlayerId ? 'playing' : 'waiting',
    whitePlayerId: game.whitePlayerId, blackPlayerId: game.blackPlayerId,
    moves: chess.history(), inCheck: chess.isCheck(), result,
  };
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f-]{36}$/.test(value);
}
function gameIdFrom(value: unknown): string | null {
  if (typeof value !== 'object' || value === null || !('gameId' in value)) return null;
  return validId(value.gameId) ? value.gameId : null;
}
function colorFor(game: Game, playerId: string | undefined): PlayerColor | null {
  if (playerId === game.whitePlayerId) return 'white';
  if (playerId && playerId === game.blackPlayerId) return 'black';
  return null;
}
function moveFrom(value: unknown): MoveIntent | null {
  if (typeof value !== 'object' || value === null) return null;
  const move = value as Record<string, unknown>;
  const square = (item: unknown) => typeof item === 'string' && /^[a-h][1-8]$/.test(item);
  if (!gameIdFrom(value) || !square(move.from) || !square(move.to)) return null;
  if (move.promotion !== undefined &&
      (typeof move.promotion !== 'string' || !['q', 'r', 'b', 'n'].includes(move.promotion))) return null;
  return move as MoveIntent;
}

io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
  // Each socket must join before it can move or resign. IDs restore seats after refresh.
  let identity: { gameId: string; playerId: string } | null = null;

  socket.on('create_game', (payload, reply) => {
    if (typeof reply !== 'function') return;
    if (typeof payload !== 'object' || payload === null ||
        (payload.playerId !== undefined && !validId(payload.playerId))) {
      reply({ ok: false, message: 'Invalid create request.' }); return;
    }
    const playerId = payload.playerId ?? randomUUID();
    const game: Game = { id: randomUUID(), whitePlayerId: playerId, blackPlayerId: null, chess: new Chess(), result: null };
    games.set(game.id, game);
    identity = { gameId: game.id, playerId };
    socket.join(room(game.id));
    reply({ ok: true, playerId, color: 'white', state: state(game) });
  });

  socket.on('join_game', (payload, reply) => {
    if (typeof reply !== 'function') return;
    const gameId = gameIdFrom(payload);
    if (!gameId || (payload.playerId !== undefined && !validId(payload.playerId))) {
      reply({ ok: false, message: 'Invalid join request.' }); return;
    }
    const game = games.get(gameId);
    if (!game) { reply({ ok: false, message: 'Game not found. The server may have restarted.' }); return; }
    const playerId = payload.playerId ?? randomUUID();
    let color = colorFor(game, playerId);
    if (!color && !game.blackPlayerId) {
      game.blackPlayerId = playerId;
      color = 'black';
      io.to(room(game.id)).emit('game_state', state(game));
    }
    if (!color) { reply({ ok: false, message: 'This game already has two players.' }); return; }
    identity = { gameId, playerId };
    socket.join(room(gameId));
    reply({ ok: true, playerId, color, state: state(game) });
  });

  socket.on('make_move', (payload) => {
    const move = moveFrom(payload);
    if (!move) { socket.emit('move_rejected', 'Malformed move request.'); return; }
    const game = games.get(move.gameId);
    if (!game || identity?.gameId !== move.gameId) {
      socket.emit('move_rejected', 'Join this game before moving.'); return;
    }
    if (state(game).status !== 'playing') { socket.emit('move_rejected', 'Game is not in progress.'); return; }
    const color = colorFor(game, identity.playerId);
    if (!color || (color === 'white' ? 'w' : 'b') !== game.chess.turn()) {
      socket.emit('move_rejected', 'It is not your turn.'); return;
    }
    const piece = game.chess.get(move.from as Square);
    if (!piece || piece.color !== game.chess.turn()) {
      socket.emit('move_rejected', 'You can only move your own pieces.'); return;
    }
    try {
      game.chess.move({ from: move.from, to: move.to, promotion: move.promotion });
    } catch {
      socket.emit('move_rejected', 'Illegal move.'); return;
    }
    io.to(room(game.id)).emit('game_state', state(game));
  });

  socket.on('resign_game', (payload) => {
    const gameId = gameIdFrom(payload);
    const game = gameId ? games.get(gameId) : undefined;
    if (!game || identity?.gameId !== gameId || state(game).status !== 'playing') {
      socket.emit('game_error', 'Cannot resign this game.'); return;
    }
    const color = colorFor(game, identity.playerId);
    if (!color) { socket.emit('game_error', 'You are not a player in this game.'); return; }
    game.result = { reason: 'resignation', winner: color === 'white' ? 'black' : 'white' };
    io.to(room(game.id)).emit('game_state', state(game));
  });
});

const port = Number(process.env.PORT ?? 3001);
httpServer.listen(port, () => console.log(`Chess server listening on http://localhost:${port}`));
