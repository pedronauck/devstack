import { createFileRoute } from "@tanstack/react-router";
import { BellRingIcon, FingerprintIcon, PaletteIcon } from "lucide-react";

import { AppTopbar } from "@/components/app-topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Surface } from "@/components/ui/surface";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <>
      <AppTopbar title="Settings" eyebrow="Starter defaults" />
      <div className="grid flex-1 gap-4 p-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Workspace defaults</CardTitle>
            <CardDescription>
              Tune a few starter surfaces before real product decisions harden them.
            </CardDescription>
            <Badge variant="outline">Template-safe</Badge>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              <Surface>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-3">
                    <div className="grid size-11 place-items-center rounded-2xl bg-primary/15 text-primary">
                      <PaletteIcon className="size-5" />
                    </div>
                    <div>
                      <h3 className="font-display text-base font-semibold tracking-tight">
                        Interface rhythm
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Start simple, then adapt spacing and hierarchy once your domain screens are
                        clear.
                      </p>
                    </div>
                  </div>
                  <Button variant="outline">Review</Button>
                </div>
              </Surface>

              <Surface>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-3">
                    <div className="grid size-11 place-items-center rounded-2xl bg-primary/15 text-primary">
                      <BellRingIcon className="size-5" />
                    </div>
                    <div>
                      <h3 className="font-display text-base font-semibold tracking-tight">
                        Signals and alerts
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Keep notifications local at first, then evolve toward email, jobs or
                        webhooks when the workflow demands it.
                      </p>
                    </div>
                  </div>
                  <Button>Enabled</Button>
                </div>
              </Surface>

              <Surface>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-3">
                    <div className="grid size-11 place-items-center rounded-2xl bg-primary/15 text-primary">
                      <FingerprintIcon className="size-5" />
                    </div>
                    <div>
                      <h3 className="font-display text-base font-semibold tracking-tight">
                        Review flows
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Add stronger confirmation and audit steps only where destructive actions
                        exist.
                      </p>
                    </div>
                  </div>
                  <Button variant="outline">Plan</Button>
                </div>
              </Surface>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Starter notes</CardTitle>
            <CardDescription>
              These placeholders are intentionally generic and should be replaced early.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              <Surface>
                <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  Project title
                </div>
                <div className="mt-2 font-display text-2xl font-bold">{{projectTitle}}</div>
                <div className="mt-2 text-sm text-muted-foreground">
                  Used in the shell header, browser metadata and starter documentation.
                </div>
              </Surface>

              <Surface>
                <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  Generic shell
                </div>
                <div className="mt-2 text-2xl font-semibold">Overview + settings</div>
                <div className="mt-2 text-sm text-muted-foreground">
                  The layout, navigation and route names are deliberately neutral so the scaffold
                  can be shaped into your own product.
                </div>
              </Surface>

              <Surface>
                <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  Next move
                </div>
                <div className="mt-2 text-sm leading-6 text-muted-foreground">
                  Replace the copy, connect real data and remove any starter surfaces that do not
                  match the product you are building.
                </div>
              </Surface>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
