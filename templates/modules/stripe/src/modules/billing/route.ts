import { z } from "@hono/zod-openapi";
import { createOpenApiApp, defineRoute, jsonBody, jsonResponse } from "@/lib/openapi";
import { dataEnvelope } from "@/lib/openapi-schemas";
import { created, ok } from "@/lib/response";
import {
  billingOverviewSchema,
  checkoutSessionRequestSchema,
  createPlanSchema,
  planSchema,
} from "./model";
import {
  createCheckoutSession,
  createPlan,
  getBillingOverview,
  listPlans,
} from "./usecases";

export const billingModule = createOpenApiApp();
export const adminPlansModule = createOpenApiApp();
export const adminBillingModule = createOpenApiApp();

billingModule.openapi(
  defineRoute({
    method: "get",
    path: "/{organizationId}",
    tags: ["Billing"],
    summary: "Get organization billing overview",
    request: {
      params: z.object({ organizationId: z.string().min(1) }),
    },
    responses: {
      200: jsonResponse(dataEnvelope(billingOverviewSchema), "Billing overview"),
    },
  }),
  async c => c.json(ok(await getBillingOverview(c.req.param("organizationId"))), 200)
);

billingModule.openapi(
  defineRoute({
    method: "post",
    path: "/checkout-session",
    tags: ["Billing"],
    summary: "Create a Stripe checkout session",
    request: {
      body: jsonBody(checkoutSessionRequestSchema, "Checkout session payload"),
    },
    responses: {
      201: jsonResponse(
        dataEnvelope(z.object({ sessionId: z.string(), url: z.string().url() })),
        "Created checkout session"
      ),
    },
  }),
  async c => c.json(created(await createCheckoutSession(await c.req.json())), 201)
);

adminPlansModule.openapi(
  defineRoute({
    method: "get",
    path: "/",
    tags: ["Admin Billing"],
    summary: "List plans",
    responses: {
      200: jsonResponse(dataEnvelope(planSchema.array()), "Plans"),
    },
  }),
  async c => c.json(ok(await listPlans()), 200)
);

adminPlansModule.openapi(
  defineRoute({
    method: "post",
    path: "/",
    tags: ["Admin Billing"],
    summary: "Create plan",
    request: {
      body: jsonBody(createPlanSchema, "Plan payload"),
    },
    responses: {
      201: jsonResponse(dataEnvelope(planSchema), "Created plan"),
    },
  }),
  async c => c.json(created(await createPlan(await c.req.json())), 201)
);

adminBillingModule.openapi(
  defineRoute({
    method: "get",
    path: "/",
    tags: ["Admin Billing"],
    summary: "List billing plans for admin",
    responses: {
      200: jsonResponse(dataEnvelope(planSchema.array()), "Plans"),
    },
  }),
  async c => c.json(ok(await listPlans()), 200)
);
