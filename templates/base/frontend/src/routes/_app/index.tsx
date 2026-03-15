import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRightIcon, Layers3Icon, RocketIcon, ShieldCheckIcon } from "lucide-react";

import { AppTopbar } from "@/components/app-topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Surface } from "@/components/ui/surface";

export const Route = createFileRoute("/_app/")({
  component: OverviewPage,
});

function OverviewPage() {
  return (
    <>
      <AppTopbar title="{{projectTitle}}" eyebrow="Workspace overview" />
      <div className="grid flex-1 gap-4 p-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <Badge variant="outline">Starter</Badge>
            <CardTitle className="text-2xl">A full-stack workspace, ready to extend.</CardTitle>
            <CardDescription>
              This shell is intentionally neutral. Replace the starter copy, shape the first
              domain routes and keep the platform primitives that already work.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Surface>
              <div className="flex items-start gap-3">
                <div className="grid size-11 place-items-center rounded-2xl bg-primary/15 text-primary">
                  <RocketIcon className="size-5" />
                </div>
                <div>
                  <h3 className="font-display text-base font-semibold tracking-tight">
                    Run the stack
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    `bun install`, `docker compose up -d`, then `bun run dev`.
                  </p>
                </div>
              </div>
            </Surface>
            <Surface>
              <div className="flex items-start gap-3">
                <div className="grid size-11 place-items-center rounded-2xl bg-primary/15 text-primary">
                  <Layers3Icon className="size-5" />
                </div>
                <div>
                  <h3 className="font-display text-base font-semibold tracking-tight">
                    Shape the first module
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Use this scaffold as the baseline for your own modules, routes, queries and
                    persistence boundaries.
                  </p>
                </div>
              </div>
            </Surface>
            <Surface>
              <div className="flex items-start gap-3">
                <div className="grid size-11 place-items-center rounded-2xl bg-primary/15 text-primary">
                  <ShieldCheckIcon className="size-5" />
                </div>
                <div>
                  <h3 className="font-display text-base font-semibold tracking-tight">
                    Keep quality gates on
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    The workspace is set up for Oxlint, Oxfmt, tsgo and Vitest from day one.
                  </p>
                </div>
              </div>
            </Surface>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Starter profile</CardTitle>
            <CardDescription>
              A reusable baseline instead of a product-specific interface.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Surface>
              <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Frontend
              </div>
              <div className="mt-2 font-display text-2xl font-bold">React 19 + TanStack</div>
              <div className="mt-2 text-sm text-muted-foreground">
                File-based routing, query caching and an app shell that is ready to be renamed.
              </div>
            </Surface>
            <Surface>
              <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Backend
              </div>
              <div className="mt-2 text-2xl font-semibold">Hono + Drizzle</div>
              <div className="mt-2 text-sm text-muted-foreground">
                OpenAPI helpers, RFC 7807 errors and clean module boundaries.
              </div>
            </Surface>
            <Surface>
              <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Tooling
              </div>
              <div className="mt-2 text-2xl font-semibold">Make + Husky + CI</div>
              <div className="mt-2 text-sm text-muted-foreground">
                Formatting, linting, type safety and tests are wired as the default quality bar.
              </div>
            </Surface>
            <Button className="justify-between" render={<Link to="/settings" />}>
              Configure shell
              <ArrowRightIcon className="size-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
