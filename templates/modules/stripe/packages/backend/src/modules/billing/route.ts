import { createOpenApiApp } from "@/lib/openapi";
import { created, ok } from "@/lib/response";
import { db } from "@/db";
import { getOrgId } from "@/lib/auth/org-context";
import { checkoutSessionRequestSchema } from "./model";
import { createCheckoutSessionForOrganization, listPlans } from "./usecases";

export const billingModule = createOpenApiApp();
export const adminPlansModule = createOpenApiApp();
export const adminBillingModule = createOpenApiApp();

billingModule.get("/", async c => {
  const plans = await listPlans({ db });

  return c.json(
    ok({
      plans,
      subscription: null,
    }),
    200
  );
});

billingModule.post("/checkout-session", async c => {
  const organizationId = getOrgId(c);
  const payload = checkoutSessionRequestSchema.parse(await c.req.json());
  const url = await createCheckoutSessionForOrganization({
    db,
    input: payload,
    organizationId,
  });

  return c.json(created({ url }), 201);
});

adminPlansModule.get("/", async c => {
  return c.json(ok(await listPlans({ db })), 200);
});

adminBillingModule.get("/", async c => {
  return c.json(ok({ subscriptions: [] }), 200);
});
