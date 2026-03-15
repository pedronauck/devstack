import { BellIcon } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

type AppTopbarProps = {
  title?: string;
  eyebrow?: string;
};

export function AppTopbar({ title = "Overview", eyebrow = "Starter shell" }: AppTopbarProps) {
  return (
    <header className="flex h-14 items-center gap-3 border-b px-4">
      <div className="min-w-0">
        <p className="text-[0.65rem] font-medium uppercase tracking-[0.24em] text-muted-foreground">
          {eyebrow}
        </p>
        <span className="font-display text-sm font-semibold">{title}</span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="icon-sm">
          <BellIcon />
        </Button>
        <ThemeToggle />
      </div>
    </header>
  );
}
