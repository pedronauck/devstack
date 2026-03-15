import { cors } from "hono/cors";
import { env } from "./env";
import { createOpenApiApp } from "./lib/openapi";
import { itemsModule } from "./modules/items";
import {
  errorHandler,
  loggingMiddleware,
  metricsMiddleware,
  metricsRoutes,
  openApiRoutes,
  REQUEST_ID_HEADER,
  requestIdMiddleware,
  type RequestIdVariables,
} from "./plugins";
import { healthRoutes } from "./routes/health";

// __MODULE_IMPORTS__

type AppVariables = RequestIdVariables;

const app = createOpenApiApp<{ Variables: AppVariables }>();
const apiRoutes = createOpenApiApp<{ Variables: AppVariables }>();

app.onError(errorHandler);
app.use("*", requestIdMiddleware);
// __MODULE_GLOBAL_MIDDLEWARE__
app.use("*", metricsMiddleware);
app.use("*", loggingMiddleware);
app.use(
  "*",
  cors({
    origin: env.CORS_ORIGIN,
    allowHeaders: ["Content-Type", "Authorization", REQUEST_ID_HEADER, "baggage", "traceparent"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    credentials: true,
    exposeHeaders: [REQUEST_ID_HEADER, "baggage", "traceparent"],
  })
);

app.doc31("/openapi.json", {
  openapi: "3.1.0",
  info: {
    title: "{{projectTitle}} API",
    version: "1.0.0",
    description: "{{projectTitle}} starter API",
  },
  servers: [{ url: env.APP_URL, description: "Application server" }],
});

app.route("/", openApiRoutes);
app.route("/metrics", metricsRoutes);
app.route("/health", healthRoutes);

// __MODULE_LAYER0__
// __MODULE_LAYER1__
// __MODULE_LAYER2__

// __MODULE_LAYER3_PRE__
apiRoutes.route("/items", itemsModule);
// __MODULE_LAYER3_ROUTES__
app.route("/api/v1", apiRoutes);

// __MODULE_LAYER4__

export default app;
