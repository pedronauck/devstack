import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const bannerVariants = cva(
  "flex items-center gap-4 rounded-2xl border border-transparent px-5 py-4 sm:gap-6 sm:px-6",
  {
    variants: {
      variant: {
        primary: "border-primary/10 bg-gradient-to-r from-primary/8 to-transparent",
        success: "border-success/10 bg-gradient-to-r from-success/8 to-transparent",
        warm: "border-accent-warm/10 bg-gradient-to-r from-accent-warm/8 to-transparent",
        destructive: "border-destructive/10 bg-gradient-to-r from-destructive/8 to-transparent",
        muted: "border-border/80 bg-muted/50",
      },
    },
    defaultVariants: {
      variant: "primary",
    },
  }
);

function Banner({
  className,
  variant = "primary",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof bannerVariants>) {
  return (
    <div data-slot="banner" className={cn(bannerVariants({ variant }), className)} {...props} />
  );
}

export { Banner, bannerVariants };
