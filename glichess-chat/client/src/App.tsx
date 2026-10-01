import { useState, type FormEvent } from "react";
import { ChatPanel } from "./components/chat/ChatPanel";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import type { Player } from "./types/chat";

const players: Record<"white" | "black", Player> = {
  white: { playerId: "white-player", playerName: "White" },
  black: { playerId: "black-player", playerName: "Black" },
};

function BoardPlaceholder() {
  return (
    <div className="overflow-hidden rounded-sm border-4 border-[#4f392d] shadow-lg" aria-label="Decorative chess board placeholder">
      <div className="grid aspect-square grid-cols-8">
        {Array.from({ length: 64 }, (_, index) => {
          const row = Math.floor(index / 8);
          const column = index % 8;
          const dark = (row + column) % 2 === 1;
          return <div key={index} className={`relative ${dark ? "bg-[#769656]" : "bg-[#eeeed2]"}`}>
            {column === 0 && <span className={`absolute left-1 top-0.5 text-[9px] font-semibold ${dark ? "text-[#eeeed2]" : "text-[#769656]"}`}>{8 - row}</span>}
            {row === 7 && <span className={`absolute bottom-0.5 right-1 text-[9px] font-semibold ${dark ? "text-[#eeeed2]" : "text-[#769656]"}`}>{"abcdefgh"[column]}</span>}
          </div>;
        })}
      </div>
    </div>
  );
}

export default function App() {
  const [playerChoice, setPlayerChoice] = useState<"white" | "black">("white");
  const [gameInput, setGameInput] = useState("game-123");
  const [joined, setJoined] = useState<{ gameId: string; player: Player } | null>(null);
  const [formError, setFormError] = useState("");

  function join(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const gameId = gameInput.trim();
    if (!gameId || gameId.length > 80) {
      setFormError("Enter a game ID of 1–80 characters.");
      return;
    }
    setFormError("");
    setJoined({ gameId, player: players[playerChoice] });
  }

  return (
    <div className="min-h-screen bg-[#f4f3ef] text-stone-900">
      <header className="border-b border-stone-200 bg-white/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#769656] text-2xl text-white" aria-hidden="true">♞</span>
            <div><h1 className="text-base font-bold leading-tight tracking-tight">Chess Chat</h1><p className="text-xs text-stone-500">A real-time game room demo</p></div>
          </div>
          <span className="hidden rounded-full border border-stone-200 px-3 py-1 text-xs text-stone-500 sm:inline">No chess moves · just chat</span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-7">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#638347]">Game room</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Play the conversation</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-stone-600">Choose a side and join a game. Open a second tab as the other player to see messages arrive live.</p>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="mx-auto w-full max-w-[620px]">
            <BoardPlaceholder />
            <div className="mt-4 flex items-center justify-between rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm">
              <div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded bg-stone-900 text-white" aria-hidden="true">♟</span><span className="font-medium">Black</span></div>
              <span className="text-xs text-stone-400">Board preview</span>
              <div className="flex items-center gap-2"><span className="font-medium">White</span><span className="grid h-7 w-7 place-items-center rounded border border-stone-300 bg-white" aria-hidden="true">♙</span></div>
            </div>
          </div>

          {joined ? <ChatPanel key={`${joined.gameId}:${joined.player.playerId}`} gameId={joined.gameId} player={joined.player} onLeave={() => setJoined(null)} /> : (
            <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6" aria-label="Join a game">
              <div className="mb-6"><h3 className="text-lg font-semibold">Join game chat</h3><p className="mt-1 text-sm text-stone-500">Both players need the same game ID.</p></div>
              <form onSubmit={join} className="space-y-5">
                <div>
                  <label htmlFor="player" className="mb-2 block text-sm font-medium">Player</label>
                  <select id="player" value={playerChoice} onChange={(event) => setPlayerChoice(event.target.value as "white" | "black")} className="h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm outline-none focus:border-[#769656] focus:ring-2 focus:ring-[#769656]/20">
                    <option value="white">White</option><option value="black">Black</option>
                  </select>
                </div>
                <div><label htmlFor="game-id" className="mb-2 block text-sm font-medium">Game ID</label><Input id="game-id" value={gameInput} onChange={(event) => setGameInput(event.target.value)} maxLength={80} autoComplete="off" /></div>
                {formError && <p role="alert" className="text-xs text-red-600">{formError}</p>}
                <Button type="submit" className="w-full">Join game</Button>
              </form>
              <div className="mt-6 rounded-lg bg-stone-50 p-3 text-xs leading-relaxed text-stone-500"><strong className="text-stone-700">Try it:</strong> Join as White here, then open another tab and join <span className="font-medium text-stone-700">game-123</span> as Black.</div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
