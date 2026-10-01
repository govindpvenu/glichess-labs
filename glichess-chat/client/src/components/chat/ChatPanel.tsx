import { useEffect, useRef, useState } from "react";
import { socket } from "../../lib/socket";
import type { ChatMessage as Message, ConnectionStatus, Player } from "../../types/chat";
import { ChatInput } from "./ChatInput";
import { ChatMessage } from "./ChatMessage";
import { PlayerHeader } from "./PlayerHeader";

interface Props { gameId: string; player: Player; onLeave: () => void }

export function ChatPanel({ gameId, player, onLeave }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>(socket.connected ? "connected" : "connecting");
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const join = () => {
      setStatus("connected");
      setError("");
      socket.emit("game:join", { gameId, ...player });
    };
    const disconnect = () => setStatus("disconnected");
    const connectError = () => {
      setStatus("disconnected");
      setError("Could not connect to the chat server. Retrying…");
    };
    const history = (items: Message[]) => setMessages(items);
    const message = (item: Message) => {
      setMessages((previous) => previous.some((existing) => existing.id === item.id)
        ? previous : [...previous, item]);
    };
    const chatError = (detail: { message: string }) => setError(detail.message);

    socket.on("connect", join);
    socket.on("disconnect", disconnect);
    socket.on("connect_error", connectError);
    socket.on("chat:history", history);
    socket.on("chat:message", message);
    socket.on("chat:error", chatError);
    if (socket.connected) join();
    else socket.connect();

    return () => {
      if (socket.connected) socket.emit("game:leave", { gameId, playerId: player.playerId });
      socket.off("connect", join);
      socket.off("disconnect", disconnect);
      socket.off("connect_error", connectError);
      socket.off("chat:history", history);
      socket.off("chat:message", message);
      socket.off("chat:error", chatError);
      socket.disconnect();
    };
  }, [gameId, player]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  return (
    <section className="flex h-[510px] min-h-0 flex-col overflow-hidden rounded-xl border border-stone-200 bg-stone-50 shadow-sm" aria-label="Game chat">
      <PlayerHeader gameId={gameId} player={player} status={status} onLeave={onLeave} />
      {error && <div role="alert" className="border-b border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">{error}</div>}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <span className="mb-3 grid h-10 w-10 place-items-center rounded-full bg-stone-200 text-lg text-stone-600" aria-hidden="true">♟</span>
            <p className="text-sm font-medium text-stone-700">No messages yet</p>
            <p className="mt-1 max-w-48 text-xs leading-relaxed text-stone-500">Say hello to your opponent to start the conversation.</p>
          </div>
        ) : (
          <ol className="space-y-4" aria-live="polite" aria-relevant="additions">
            {messages.map((item) => <ChatMessage key={item.id} message={item} mine={item.playerId === player.playerId} />)}
          </ol>
        )}
        <div ref={bottomRef} />
      </div>
      <ChatInput disabled={status !== "connected"} onSend={(text) => { setError(""); socket.emit("chat:send", { gameId, ...player, text }); }} />
    </section>
  );
}
