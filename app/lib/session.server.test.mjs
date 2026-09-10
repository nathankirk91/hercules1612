import assert from "node:assert/strict";
import { test } from "node:test";

const {
  SESSION_MAX_AGE_SECONDS,
  getSession,
  commitSession,
} = await import("./session.server.ts");

test("SESSION_MAX_AGE_SECONDS is 30 days", () => {
  assert.equal(SESSION_MAX_AGE_SECONDS, 60 * 60 * 24 * 30);
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
