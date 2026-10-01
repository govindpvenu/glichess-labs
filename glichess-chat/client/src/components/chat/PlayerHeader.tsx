import type { ConnectionStatus, Player } from "../../types/chat";

interface Props {
  gameId: string;
  player: Player;
  status: ConnectionStatus;
  onLeave: () => void;
}

export function PlayerHeader({ gameId, player, status, onLeave }: Props) {
  const statusText = status === "connected" ? "Connected" : status === "connecting" ? "Connecting" : "Disconnected";
  return (
    <header className="border-b border-stone-200 px-4 py-3 sm:px-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-stone-900">Game chat</h2>
            <span className={`h-2 w-2 rounded-full ${status === "connected" ? "bg-emerald-500" : status === "connecting" ? "bg-amber-400" : "bg-stone-400"}`} aria-hidden="true" />
          </div>
          <p className="mt-0.5 text-xs text-stone-500" role="status">{statusText} · {gameId}</p>
        </div>
        <button type="button" onClick={onLeave} className="rounded px-1 py-0.5 text-xs font-medium text-stone-500 hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-[#769656]">Leave game</button>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-stone-600">
        <span className={`grid h-6 w-6 place-items-center rounded border ${player.playerId === "white-player" ? "border-stone-300 bg-white text-stone-800" : "border-stone-800 bg-stone-800 text-white"}`} aria-hidden="true">♟</span>
        Playing as <strong className="font-medium text-stone-900">{player.playerName}</strong>
      </div>
    </header>
  );
}
