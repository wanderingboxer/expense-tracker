import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

function makeRequest(path: string, cookie?: string) {
  const req = new NextRequest(`http://localhost${path}`, {
    headers: cookie ? { cookie } : undefined,
  });
  return req;
}

describe("middleware", () => {
  it("does not redirect API routes without a session cookie (they enforce their own auth)", () => {
    const res = middleware(makeRequest("/api/cron/sync"));
    expect(res.status).toBe(200); // NextResponse.next() reports 200, not a redirect
    expect(res.headers.get("location")).toBeNull();
  });

  it("does not redirect /api/gmail/sync without a session cookie either", () => {
    const res = middleware(makeRequest("/api/gmail/sync"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("still redirects unauthenticated page requests to /login", () => {
    const res = middleware(makeRequest("/transactions"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("allows page requests through with a session cookie present", () => {
    const res = middleware(makeRequest("/transactions", "authjs.session-token=abc123"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("allows the login page itself without a session cookie", () => {
    const res = middleware(makeRequest("/login"));
    expect(res.headers.get("location")).toBeNull();
  });
});
