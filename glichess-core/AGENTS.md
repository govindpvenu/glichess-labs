# Project Instructions

This is a learning project for an online multiplayer chess game.

## Stack

Frontend:

- React
- Vite
- TypeScript
- react-chessboard
- chess.js
- Socket.IO client
- Tailwind CSS
- shadcn/ui

Backend:

- Express
- TypeScript
- Socket.IO
- chess.js

Monorepo:

- pnpm workspaces

## Architecture

apps/web

- React frontend

apps/server

- Express + Socket.IO server

packages/shared

- Shared TypeScript types and Socket.IO event contracts

## Important Rules

The server is authoritative for chess game state.

Never trust:

- client FEN
- client turn state
- client claims that a move is legal

The client sends move intent:

{
gameId,
from,
to,
promotion
}

The server validates and applies the move using chess.js.

The server then broadcasts the authoritative game state.

## Scope

For version 1 do NOT add:

- database
- Redis
- authentication
- matchmaking
- Stockfish
- Redux
- Zustand

Games should be held in server memory using a Map.

Keep the architecture straightforward and educational.

Avoid unnecessary abstraction.

Prefer explicit TypeScript types and readable code.

Run typechecking after making significant changes.
