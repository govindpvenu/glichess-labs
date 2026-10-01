import { useEffect, useRef, useState } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  GameState,
  PlayerColor,
  Promotion,
  ServerToClientEvents,
} from "@chess/shared";
import { Button } from "@/components/ui/button";
import "./App.css";

type ChessSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
const serverUrl = import.meta.env.VITE_SERVER_URL ?? "http://localhost:3001";
const gamePath = () =>
  window.location.pathname.match(/^\/game\/([0-9a-f-]{36})$/)?.[1] ?? null;
const playerKey = (gameId: string) => `chess_player_id:${gameId}`;

function App() {
  const socketRef = useRef<ChessSocket | null>(null);
  const [gameId, setGameId] = useState<string | null>(gamePath);
  const [game, setGame] = useState<GameState | null>(null);
  const [color, setColor] = useState<PlayerColor | null>(null);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [promotion, setPromotion] = useState<{
    from: string;
    to: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const socket: ChessSocket = io(serverUrl);
    socketRef.current = socket;
    const join = () => {
      setConnected(true);
      const currentId = gamePath();
      if (!currentId) return;
      const playerId =
        sessionStorage.getItem(playerKey(currentId)) ??
        (sessionStorage.getItem("chess_active_game") === currentId
          ? localStorage.getItem(playerKey(currentId))
          : null) ??
        undefined;
      socket.emit("join_game", { gameId: currentId, playerId }, (result) => {
        if (!result.ok) {
          setMessage(result.message);
          setBusy(false);
          return;
        }
        sessionStorage.setItem(playerKey(currentId), result.playerId);
        sessionStorage.setItem("chess_active_game", currentId);
        localStorage.setItem(playerKey(currentId), result.playerId);
        setColor(result.color);
        setGame(result.state);
        setMessage("");
        setBusy(false);
      });
    };
    socket.on("connect", join);
    socket.on("disconnect", () => {
      setConnected(false);
      setMessage("Connection lost. Reconnecting…");
    });
    socket.on("connect_error", () =>
      setMessage("Cannot reach the game server. Is it running?"),
    );
    socket.on("game_state", (next) => {
      setGame(next);
      setMessage("");
    });
    socket.on("move_rejected", setMessage);
    socket.on("game_error", setMessage);
    const onPopState = () => {
      setGameId(gamePath());
      window.location.reload();
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      socket.disconnect();
      window.removeEventListener("popstate", onPopState);
      socketRef.current = null;
    };
  }, []);

  function createGame() {
    const socket = socketRef.current;
    if (!socket?.connected) {
      setMessage("Connect to the server first.");
      return;
    }
    setBusy(true);
    setMessage("");
    socket.emit("create_game", {}, (result) => {
      setBusy(false);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      sessionStorage.setItem(playerKey(result.state.gameId), result.playerId);
      sessionStorage.setItem("chess_active_game", result.state.gameId);
      localStorage.setItem(playerKey(result.state.gameId), result.playerId);
      window.history.pushState({}, "", `/game/${result.state.gameId}`);
      setGameId(result.state.gameId);
      setGame(result.state);
      setColor(result.color);
    });
  }

  function sendMove(from: string, to: string, selectedPromotion?: Promotion) {
    if (!game || !socketRef.current) return;
    socketRef.current.emit("make_move", {
      gameId: game.gameId,
      from,
      to,
      promotion: selectedPromotion,
    });
    setPromotion(null);
  }

  function onPieceDrop(
    sourceSquare: string,
    targetSquare: string | null,
    piece: string,
  ) {
    if (
      !targetSquare ||
      !game ||
      game.status !== "playing" ||
      !color ||
      game.turn !== (color === "white" ? "w" : "b")
    )
      return false;
    const isPawnPromotion =
      piece.endsWith("P") &&
      (targetSquare.endsWith("8") || targetSquare.endsWith("1"));
    if (isPawnPromotion) setPromotion({ from: sourceSquare, to: targetSquare });
    else sendMove(sourceSquare, targetSquare);
    // The piece moves only when the server returns the updated FEN.
    return false;
  }

  const shareUrl = gameId ? `${window.location.origin}/game/${gameId}` : "";
  const canMove = Boolean(
    game &&
    color &&
    game.status === "playing" &&
    game.turn === (color === "white" ? "w" : "b"),
  );
  const turnName = game?.turn === "w" ? "White" : "Black";
  const resultText = game?.result
    ? game.result.winner
      ? `${game.result.winner === "white" ? "White" : "Black"} wins by ${game.result.reason}`
      : `Draw by ${game.result.reason}`
    : null;

  return (
    <main className="shell antialiased">
      <header className="site-header">
        <a href="/" className="brand">
          ♞ GliChess Core
        </a>
        <span className={connected ? "online" : "offline"}>
          {connected ? "Connected" : "Offline"}
        </span>
      </header>
      {!gameId ? (
        <section className="home card">
          <span className="eyebrow">Play together</span>
          <h1>GliChess Core</h1>
          <p>
            Create a game and send the link to a friend. You play White; they
            play Black.
          </p>
          <Button onClick={createGame} disabled={busy || !connected}>
            {busy ? "Creating…" : "Create Game"}
          </Button>
        </section>
      ) : (
        <div className="game-layout">
          <section className="board-column">
            <div className="player-label">
              <span
                className={`piece-dot ${color === "black" ? "light" : "dark"}`}
              />
              {color === "black" ? "Opponent · White" : "Opponent · Black"}
            </div>
            <div className="board-wrap">
              <Chessboard
                options={{
                  position: game?.fen ?? new Chess().fen(),
                  boardOrientation: color ?? "white",
                  allowDragging: canMove,
                  canDragPiece: ({ piece }) =>
                    canMove &&
                    piece.pieceType.startsWith(color === "white" ? "w" : "b"),
                  onPieceDrop: ({ piece, sourceSquare, targetSquare }) =>
                    onPieceDrop(sourceSquare, targetSquare, piece.pieceType),
                  lightSquareStyle: { backgroundColor: "#e9e1d1" },
                  darkSquareStyle: { backgroundColor: "#799482" },
                  boardStyle: { borderRadius: 8, overflow: "hidden" },
                }}
              />
            </div>
            <div className="player-label">
              <span
                className={`piece-dot ${color === "black" ? "dark" : "light"}`}
              />
              {color === "black" ? "You · Black" : "You · White"}
            </div>
          </section>
          <aside className="sidebar">
            <section className="card status-card">
              <span className="eyebrow">Game status</span>
              <h1>
                {resultText ??
                  (game?.status === "waiting"
                    ? "Waiting for opponent…"
                    : game?.status === "playing"
                      ? `${turnName} to move`
                      : "Joining game…")}
              </h1>
              <p>
                {game?.inCheck && !game.result
                  ? `${turnName} is in check.`
                  : game?.status === "waiting"
                    ? "Share this link to invite Black."
                    : color
                      ? `You are playing ${color}.`
                      : "Connecting to the game…"}
              </p>
            </section>
            <section className="card">
              <h2>Invite link</h2>
              <div className="link-box">{shareUrl}</div>
              <Button
                variant="secondary"
                className="mt-3"
                onClick={async () => {
                  await navigator.clipboard.writeText(shareUrl);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? "Copied!" : "Copy Link"}
              </Button>
            </section>
            <section className="card history-card">
              <h2>Moves</h2>
              {game?.moves.length ? (
                <ol>
                  {Array.from(
                    { length: Math.ceil(game.moves.length / 2) },
                    (_, index) => (
                      <li key={index}>
                        <span>{game.moves[index * 2]}</span>
                        <span>{game.moves[index * 2 + 1] ?? "…"}</span>
                      </li>
                    ),
                  )}
                </ol>
              ) : (
                <p>No moves yet.</p>
              )}
            </section>
            {game?.status === "playing" && (
              <button
                className="text-button"
                onClick={() =>
                  socketRef.current?.emit("resign_game", {
                    gameId: game.gameId,
                  })
                }
              >
                Resign game
              </button>
            )}
          </aside>
        </div>
      )}
      {message && (
        <div className="notice" role="alert">
          {message}
        </div>
      )}
      {promotion && (
        <div className="modal-backdrop">
          <div
            className="card promotion-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Choose promotion"
          >
            <h2>Choose promotion</h2>
            <div className="promotion-options">
              {(["q", "r", "b", "n"] as const).map((choice) => (
                <button
                  key={choice}
                  onClick={() => sendMove(promotion.from, promotion.to, choice)}
                >
                  {{ q: "Queen", r: "Rook", b: "Bishop", n: "Knight" }[choice]}
                </button>
              ))}
            </div>
            <button className="text-button" onClick={() => setPromotion(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

export default App;
