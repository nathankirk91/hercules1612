import assert from "node:assert/strict";
import { test } from "node:test";

const {
  SESSION_MAX_AGE_SECONDS,
  SESSION_REFRESH_INTERVAL_SECONDS,
  SESSION_TOUCHED_AT_KEY,
  getSession,
  commitSession,
  shouldRefreshSessionTouch,
  maybeExtendSession,
} = await import("./session.server.ts");

test("SESSION_MAX_AGE_SECONDS is 7 days", () => {
  assert.equal(SESSION_MAX_AGE_SECONDS, 60 * 60 * 24 * 7);
});

test("SESSION_REFRESH_INTERVAL_SECONDS is 1 day", () => {
  assert.equal(SESSION_REFRESH_INTERVAL_SECONDS, 60 * 60 * 24);
});

test("shouldRefreshSessionTouch is true without a prior touch", () => {
  assert.equal(shouldRefreshSessionTouch(undefined), true);
  assert.equal(shouldRefreshSessionTouch("bad"), true);
});

test("shouldRefreshSessionTouch stays false within the refresh interval", () => {
  const now = 1_700_000_000_000;
  const touchedAt = now - SESSION_REFRESH_INTERVAL_SECONDS * 1000 + 1;
  assert.equal(shouldRefreshSessionTouch(touchedAt, now), false);
});

test("shouldRefreshSessionTouch is true after the refresh interval", () => {
  const now = 1_700_000_000_000;
  const touchedAt = now - SESSION_REFRESH_INTERVAL_SECONDS * 1000;
  assert.equal(shouldRefreshSessionTouch(touchedAt, now), true);
});

test("commitSession sets Max-Age so login survives browser restarts", async () => {
  const session = await getSession(null);
  session.set("user", { id: "test-user" });

  const setCookie = await commitSession(session);
  assert.match(setCookie, /__solenis_session=/);
  assert.match(
    setCookie,
    new RegExp(`(?:^|;\\s*)Max-Age=${SESSION_MAX_AGE_SECONDS}(?:;|$)`, "i"),
  );
});

test("maybeExtendSession rewrites cookie once, then skips until interval elapses", async () => {
  const now = 1_700_000_000_000;
  const session = await getSession(null);
  session.set("user", { id: "test-user" });
  session.set(SESSION_TOUCHED_AT_KEY, now - SESSION_REFRESH_INTERVAL_SECONDS * 1000);
  const cookie = await commitSession(session);
  const cookieHeader = cookie.split(";")[0] ?? "";

  const request = new Request("https://example.com/", {
    headers: { cookie: cookieHeader },
  });

  const first = await maybeExtendSession(request, now);
  assert.ok(first);
  const setCookie = first.get("set-cookie");
  assert.ok(setCookie);
  assert.match(
    setCookie,
    new RegExp(`(?:^|;\\s*)Max-Age=${SESSION_MAX_AGE_SECONDS}(?:;|$)`, "i"),
  );

  const refreshedCookie = setCookie.split(";")[0] ?? "";
  const second = await maybeExtendSession(
    new Request("https://example.com/", {
      headers: { cookie: refreshedCookie },
    }),
    now + 60_000,
  );
  assert.equal(second, null);
});

test("maybeExtendSession does nothing when logged out", async () => {
  const headers = await maybeExtendSession(
    new Request("https://example.com/"),
  );
  assert.equal(headers, null);
});
