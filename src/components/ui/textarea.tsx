import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input placeholder:text-muted-foreground flex field-sizing-content min-h-24 w-full rounded-2xl border bg-card/80 px-4 py-3 text-base shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] transition-all duration-200 outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
        "focus-visible:border-brand/50 focus-visible:ring-brand/20 focus-visible:ring-[3px]",
        "focus-visible:bg-gradient-to-br focus-visible:from-brand/15 focus-visible:via-background focus-visible:to-brand/5",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
