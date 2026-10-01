# Chess game chat demo

A small standalone chat module for a two-player chess game. The board is decorative; there is no chess logic, account system, or database. Messages live in server memory and disappear when the server restarts.

## Run it

Requires a recent Node.js LTS release and npm.

```bash
npm install
npm install --prefix server
npm install --prefix client
npm run dev
```

Open `http://localhost:5173`. The server runs at `http://localhost:3000` (health check: `/health`). Copy `server/.env.example` to `server/.env` and `client/.env.example` to `client/.env` to change the default ports or URL. Set `CLIENT_ORIGIN` to the frontend origin when changing its address. For a production-style build, run `npm run build`, then `npm run start --prefix server` and serve `client/dist` with a static web server.

## Try two players

1. In tab A, join `game-123` as White.
2. In tab B, join `game-123` as Black.
3. Send a message in either tab. It appears once in both, in chronological order.
4. Refresh a tab and join the same game again to load its in-memory history.
5. Join `game-456` in a third tab to see that game rooms are isolated.

## Architecture

React handles the compact chat UI with Tailwind CSS and local shadcn/ui Button and Input components. Component state is small enough that Zustand is not needed. One Socket.IO client connection per tab communicates with the Express/Socket.IO server. The server maps each game ID to a room and keeps the latest 100 messages per game. It caches up to 100 game histories, evicting old inactive rooms first when needed.

```text
Browser A (White)
    │ chat:send
    ▼
Socket.IO server ── io.to(game:game-123).emit("chat:message")
    ├───────────────────┐
    ▼                   ▼
Browser A (White)   Browser B (Black)
```

`gameId → Socket.IO room`, `player → socket's current game association`, and `chat message → room broadcast`. Socket.IO provides an active connection, room broadcasts, and automatic reconnection, which keeps the demo focused on game chat.

| Direction | Event | Purpose |
| --- | --- | --- |
| Client → server | `game:join` | Validate player and game, join `game:<gameId>`, send history |
| Client → server | `game:leave` | Leave the current game room |
| Client → server | `chat:send` | Validate and store a message, then broadcast it |
| Server → client | `chat:history` | Current game's messages on join or reconnect |
| Server → client | `chat:message` | One new message sent to every socket in the room, including its sender |
| Server → client | `chat:error` | Validation or membership error |

The server trims text, rejects empty or over-300-character messages, and creates IDs and timestamps. It checks that a sending socket joined the stated game as the stated player. The UI registers listeners once per joined game and removes them on leave; reconnect triggers a fresh join and history load.

To integrate this into a chess game later, pass the actual game ID and player identity to `ChatPanel` when a game starts, and unmount it when the player leaves the game. Replace the demo player selector with the platform's existing game context. A real platform would also verify player identity and game access on the server.
