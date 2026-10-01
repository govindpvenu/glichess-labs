import { useState, type FormEvent } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

interface Props { disabled: boolean; onSend: (text: string) => void }

export function ChatInput({ disabled, onSend }: Props) {
  const [text, setText] = useState("");
  const count = text.trim().length;
  const tooLong = count > 300;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!count || tooLong || disabled) return;
    onSend(text.trim());
    setText("");
  }

  return (
    <form onSubmit={handleSubmit} className="border-t border-stone-200 bg-white p-3 sm:p-4">
      <div className="flex gap-2">
        <Input aria-label="Chat message" placeholder={disabled ? "Waiting for connection…" : "Type a message…"} value={text} onChange={(event) => setText(event.target.value)} disabled={disabled} />
        <Button type="submit" disabled={disabled || !count || tooLong}>Send</Button>
      </div>
      <div className="mt-1.5 flex justify-between px-1 text-[11px] text-stone-400">
        <span>{tooLong ? "Message is too long" : "Be respectful. Enjoy the game."}</span>
        <span className={tooLong ? "text-red-600" : ""}>{count}/300</span>
      </div>
    </form>
  );
}
