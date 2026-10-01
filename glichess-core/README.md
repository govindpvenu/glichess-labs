# GliChess Core

A small two-player chess app. The server owns each `Chess` instance in an in-memory `Map`; clients send only move intent. Socket.IO rooms carry the server's serialized game state to both players.

## Run locally

Install dependencies with `pnpm install`. In two terminals, run:

```sh
pnpm dev:server
pnpm dev:web
```

Open http://localhost:5173, create a game, and open the copied link in a second browser or tab. The first player is White; the second is Black. Run `pnpm typecheck` and `pnpm --filter @chess/web lint` to check the code.

The web app uses `http://localhost:3001` by default. Set `VITE_SERVER_URL` for a different server URL and `WEB_ORIGIN` on the server for a different web origin.

## How synchronization works

`create_game` and `join_game` return a player ID, color, and current state. The web app stores the ID per game in session storage (and local storage) so a refresh in the same tab can reclaim its seat. The browser sends `{ gameId, from, to, promotion }` for a move. The server checks socket membership, turn, piece ownership, and legality with chess.js before broadcasting `game_state` to `game:<id>`. The board renders only the latest server FEN. The server also handles checkmate, stalemate, other chess.js draws, and resignation.

Games vanish when the server restarts. Player IDs are bearer secrets kept in browser storage, so someone who obtains an ID can take that seat. This is suitable for learning, not secure authentication. The server does not currently persist games or provide spectators.
