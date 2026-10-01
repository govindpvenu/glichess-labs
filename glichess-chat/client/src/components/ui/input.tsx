import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";

export function Input({ className, type, ...props }: ComponentProps<"input">) {
  return <input data-slot="input" type={type} className={cn("h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-900 outline-none placeholder:text-stone-400 focus:border-[#769656] focus:ring-2 focus:ring-[#769656]/20 disabled:cursor-not-allowed disabled:bg-stone-100", className)} {...props} />;
}
