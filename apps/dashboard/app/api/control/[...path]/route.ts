import type { NextRequest } from "next/server";

const CONTROL_PLANE = process.env.CONTROL_PLANE_INTERNAL_URL ?? "http://127.0.0.1:4000";

type RouteContext = { params: Promise<{ path: string[] }> };

async function forward(request: NextRequest, context: RouteContext): Promise<Response> {
  const { path } = await context.params;
  const target = new URL(path.join("/"), `${CONTROL_PLANE.replace(/\/$/, "")}/`);
  target.search = request.nextUrl.search;
  const body = request.method === "GET" || request.method === "HEAD"
    ? undefined
    : await request.arrayBuffer();
  const upstream = await fetch(target, {
    method: request.method,
    headers: { "content-type": request.headers.get("content-type") ?? "application/json" },
    body,
    cache: "no-store",
  });
  return new Response(upstream.body, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
  });
}

export const GET = forward;
export const POST = forward;
