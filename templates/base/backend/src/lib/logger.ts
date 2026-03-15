import { AsyncLocalStorage } from "node:async_hooks";
import {
  configureSync,
  getConsoleSink,
  getLogger,
  getTextFormatter,
  resetSync,
  type LogRecord,
  type Sink,
} from "@logtape/logtape";
import { isSpanContextValid, trace } from "@opentelemetry/api";

const SERVICE_NAME = "{{projectName}}-backend";
const contextLocalStorage = new AsyncLocalStorage<Record<string, unknown>>();

type LoggerConsole = Pick<Console, "debug" | "error" | "info" | "log" | "warn">;
type LoggerMode = "json" | "text";
type LoggerLevel = "debug" | "error" | "info";

interface ConfigureBackendLoggerOptions {
  console?: LoggerConsole;
  force?: boolean;
  level?: LoggerLevel;
  mode?: LoggerMode;
  rawEnv?: Record<string, string | undefined>;
}

let isConfigured = false;

function normalizeLogValue(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      message: value.message,
      name: value.name,
      stack: value.stack,
    };
  }

  return value;
}

function renderLogMessage(record: LogRecord): string {
  return record.message
    .map(part => {
      if (typeof part === "string") {
        return part;
      }

      if (typeof part === "number" || typeof part === "boolean") {
        return String(part);
      }

      try {
        return JSON.stringify(normalizeLogValue(part));
      } catch {
        return String(part);
      }
    })
    .join("");
}

export function serializeLogRecord(record: LogRecord) {
  const activeSpanContext = trace.getActiveSpan()?.spanContext();

  return {
    timestamp: new Date(record.timestamp).toISOString(),
    level: record.level === "warning" ? "warn" : record.level,
    message: renderLogMessage(record),
    service: SERVICE_NAME,
    ...(activeSpanContext && isSpanContextValid(activeSpanContext)
      ? {
          spanId: activeSpanContext.spanId,
          traceId: activeSpanContext.traceId,
        }
      : {}),
    ...Object.fromEntries(
      Object.entries(record.properties).map(([key, value]) => [key, normalizeLogValue(value)])
    ),
  };
}

function createJsonConsoleSink(outputConsole: LoggerConsole): Sink {
  return record => {
    const payload = JSON.stringify(serializeLogRecord(record));
    const level = record.level === "warning" ? "warn" : record.level;

    switch (level) {
      case "debug":
        outputConsole.debug(payload);
        return;
      case "error":
      case "fatal":
        outputConsole.error(payload);
        return;
      case "warn":
        outputConsole.warn(payload);
        return;
      default:
        outputConsole.info(payload);
    }
  };
}

function resolveLoggerMode(rawEnv: Record<string, string | undefined>): LoggerMode {
  if (rawEnv.LOG_FORMAT === "json") {
    return "json";
  }

  return rawEnv.NODE_ENV === "production" ? "json" : "text";
}

function resolveLoggerLevel(rawEnv: Record<string, string | undefined>): LoggerLevel {
  const rawLevel = rawEnv.LOG_LEVEL?.toLowerCase();

  if (rawLevel === "debug" || rawLevel === "error" || rawLevel === "info") {
    return rawLevel;
  }

  return rawEnv.NODE_ENV === "test" ? "error" : "info";
}

export function configureBackendLogger(options: ConfigureBackendLoggerOptions = {}) {
  if (isConfigured && !options.force) {
    return;
  }

  const rawEnv = options.rawEnv ?? process.env;
  const mode = options.mode ?? resolveLoggerMode(rawEnv);
  const level = options.level ?? resolveLoggerLevel(rawEnv);
  const outputConsole = options.console ?? console;
  const sinkConsole: Console = Object.assign(Object.create(console), console, outputConsole);
  const sink =
    mode === "json"
      ? createJsonConsoleSink(outputConsole)
      : getConsoleSink({
          console: sinkConsole,
          formatter: getTextFormatter(),
        });

  configureSync({
    contextLocalStorage,
    loggers: [
      {
        category: ["{{projectName}}"],
        lowestLevel: level,
        sinks: ["console"],
      },
      {
        category: ["logtape"],
        lowestLevel: "error",
        sinks: ["console"],
      },
    ],
    reset: true,
    sinks: {
      console: sink,
    },
  });

  isConfigured = true;
}

export function resetBackendLoggerForTests() {
  resetSync();
  isConfigured = false;
}

export const logger = getLogger(["{{projectName}}", "backend"]);
