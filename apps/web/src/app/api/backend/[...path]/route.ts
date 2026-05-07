import { NextResponse } from "next/server";

import { fetchBackend } from "@/lib/backend-api";

type RouteContext = {
  params: Promise<{
    path?: string[];
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  return proxyBackend(request, context);
}

export async function POST(request: Request, context: RouteContext) {
  return proxyBackend(request, context);
}

export async function PATCH(request: Request, context: RouteContext) {
  return proxyBackend(request, context);
}

export async function DELETE(request: Request, context: RouteContext) {
  return proxyBackend(request, context);
}

async function proxyBackend(request: Request, context: RouteContext) {
  const { path = [] } = await context.params;
  const sourceUrl = new URL(request.url);
  const backendPath = `/${path.map(encodeURIComponent).join("/")}${sourceUrl.search}`;
  const headers = forwardedHeaders(request.headers);

  try {
    const response = await fetchBackend(backendPath, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : await request.text(),
      cache: "no-store",
    });
    return new NextResponse(response.body, {
      status: response.status,
      headers: responseHeaders(response.headers),
    });
  } catch (error) {
    return NextResponse.json(
      {
        detail: error instanceof Error ? error.message : "Backend API is unreachable.",
      },
      { status: 502 },
    );
  }
}

function forwardedHeaders(headers: Headers) {
  const nextHeaders = new Headers();
  for (const [key, value] of headers.entries()) {
    if (["accept", "content-type", "x-organization-id", "x-user-id"].includes(key.toLowerCase())) {
      nextHeaders.set(key, value);
    }
  }
  return nextHeaders;
}

function responseHeaders(headers: Headers) {
  const nextHeaders = new Headers();
  const contentType = headers.get("content-type");
  if (contentType) nextHeaders.set("content-type", contentType);
  return nextHeaders;
}
