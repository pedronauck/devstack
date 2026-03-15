import { withContext } from "@logtape/logtape";
import { createMiddleware } from "hono/factory";

export const REQUEST_ID_HEADER = "X-Request-Id";

export type RequestIdVariables = {
  requestId: string;
};

function resolveRequestId(headerValue: string | undefined) {
  const trimmedValue = headerValue?.trim();

  if (trimmedValue) {
    return trimmedValue;
  }

  return crypto.randomUUID();
}

export const requestIdMiddleware = createMiddleware<{
  Variables: RequestIdVariables;
}>(async (c, next) => {
  const requestId = resolveRequestId(c.req.header("x-request-id"));

  c.set("requestId", requestId);
  c.header(REQUEST_ID_HEADER, requestId);

  try {
    await withContext({ requestId }, async () => {
      await next();
    });
  } finally {
    c.header(REQUEST_ID_HEADER, requestId);
  }
});
