import * as React from "react";

import { cn } from "@/lib/utils/cn";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onWheel, ...props }, ref) => {
    return (
      <input
        type={type}
        // A focused <input type="number"> silently increments/decrements on
        // mouse-wheel scroll in Chrome/Edge — scrolling the page while an
        // amount field happens to be focused quietly changes a money value
        // with no visible feedback. Blur it instead, so scrolling just
        // scrolls.
        onWheel={
          type === "number"
            ? (e) => {
                e.currentTarget.blur();
                onWheel?.(e);
              }
            : onWheel
        }
        className={cn(
          "flex h-11 w-full rounded-2xl border border-input bg-background px-4 py-2 text-sm shadow-soft ring-offset-background transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
