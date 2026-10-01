import type { ChatMessage as Message } from "../../types/chat";

interface Props { message: Message; mine: boolean }

export function ChatMessage({ message, mine }: Props) {
  const time = new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <li className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] ${mine ? "text-right" : "text-left"}`}>
        <div className="mb-1 flex items-baseline justify-between gap-3 px-1 text-[11px] text-stone-500">
          <span className="font-medium">{mine ? "You" : message.playerName}</span>
          <time dateTime={new Date(message.timestamp).toISOString()}>{time}</time>
        </div>
        <p className={`whitespace-pre-wrap break-words rounded-xl px-3 py-2 text-sm leading-relaxed ${mine ? "rounded-tr-sm bg-[#769656] text-white" : "rounded-tl-sm border border-stone-200 bg-white text-stone-800"}`}>{message.text}</p>
      </div>
    </li>
  );
}
