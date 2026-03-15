import {
  createOpenApiApp,
  defineRoute,
  jsonBody,
  jsonResponse,
  noContentResponse,
} from "@/lib/openapi";
import { dataEnvelope } from "@/lib/openapi-schemas";
import { created, noContent, ok } from "@/lib/response";
import { createItemSchema, itemParamsSchema, itemSchema, updateItemSchema } from "./model";
import {
  createItem,
  deleteItem,
  getItem,
  listItems,
  updateItem,
} from "./usecases";

export const itemsModule = createOpenApiApp();

const listRoute = defineRoute({
  method: "get",
  path: "/",
  tags: ["Items"],
  summary: "List example items",
  responses: {
    200: jsonResponse(dataEnvelope(itemSchema.array()), "Example items"),
  },
});

const getRoute = defineRoute({
  method: "get",
  path: "/{itemId}",
  tags: ["Items"],
  summary: "Get example item",
  request: {
    params: itemParamsSchema,
  },
  responses: {
    200: jsonResponse(dataEnvelope(itemSchema), "Example item"),
  },
});

const createRoute = defineRoute({
  method: "post",
  path: "/",
  tags: ["Items"],
  summary: "Create example item",
  request: {
    body: jsonBody(createItemSchema, "Create item payload"),
  },
  responses: {
    201: jsonResponse(dataEnvelope(itemSchema), "Created example item"),
  },
});

const updateRoute = defineRoute({
  method: "patch",
  path: "/{itemId}",
  tags: ["Items"],
  summary: "Update example item",
  request: {
    params: itemParamsSchema,
    body: jsonBody(updateItemSchema, "Update item payload"),
  },
  responses: {
    200: jsonResponse(dataEnvelope(itemSchema), "Updated example item"),
  },
});

const deleteRoute = defineRoute({
  method: "delete",
  path: "/{itemId}",
  tags: ["Items"],
  summary: "Delete example item",
  request: {
    params: itemParamsSchema,
  },
  responses: {
    204: noContentResponse(),
  },
});

itemsModule.openapi(listRoute, async c => c.json(ok(await listItems()), 200));
itemsModule.openapi(getRoute, async c => c.json(ok(await getItem(c.req.param("itemId"))), 200));
itemsModule.openapi(createRoute, async c => c.json(created(await createItem(await c.req.json())), 201));
itemsModule.openapi(updateRoute, async c =>
  c.json(ok(await updateItem(c.req.param("itemId"), await c.req.json())), 200)
);
itemsModule.openapi(deleteRoute, async c => {
  await deleteItem(c.req.param("itemId"));
  return c.json(noContent(), 204);
});
