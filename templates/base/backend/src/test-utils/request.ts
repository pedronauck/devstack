type TestRequestOptions = {
  baseUrl?: string;
  body?: BodyInit | null;
  headers?: HeadersInit;
  json?: unknown;
};

type TestRequestResult<TBody = unknown> = {
  body: TBody;
  headers: Headers;
  response: Response;
  status: number;
};

type RequestTarget =
  | {
      request: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
    }
  | {
      fetch: (request: Request) => Promise<Response>;
    };

function hasRequestMethod(target: RequestTarget): target is Extract<RequestTarget, { request: unknown }> {
  return "request" in target;
}

export async function testRequest<TBody = unknown>(
  target: RequestTarget,
  method: string,
  path: string,
  options: TestRequestOptions = {}
): Promise<TestRequestResult<TBody>> {
  const url = `${options.baseUrl ?? "http://localhost"}${path}`;
  const headers = new Headers(options.headers);
  let body = options.body ?? null;

  if (options.json !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(options.json);
  }

  const response = hasRequestMethod(target)
    ? await target.request(url, {
        method,
        headers,
        body,
      })
    : await target.fetch(
        new Request(url, {
          method,
          headers,
          body,
        })
      );

  const contentType = response.headers.get("content-type") ?? "";
  let parsedBody: TBody | null = null;

  if (contentType.includes("application/json") || contentType.includes("+json")) {
    parsedBody = (await response.json()) as TBody;
  } else {
    const text = await response.text();
    parsedBody = (text === "" ? null : text) as TBody;
  }

  return {
    status: response.status,
    body: parsedBody as TBody,
    headers: response.headers,
    response,
  };
}
