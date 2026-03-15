import * as React from "react";

import { cn } from "@/lib/utils";

function Surface({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="surface"
      className={cn("rounded-xl border bg-muted/50 p-4", className)}
      {...props}
    />
  );
}

export { Surface };
