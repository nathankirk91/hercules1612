import { createCookieSessionStorage } from "react-router";

/** Absolute cookie lifetime after login or each sliding refresh (7 days). */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

/**
 * Do not rewrite the cookie more often than this. Daily app use still
 * extends the session, without a Set-Cookie on every navigation.
 */
export const SESSION_REFRESH_INTERVAL_SECONDS = 60 * 60 * 24;

export const SESSION_TOUCHED_AT_KEY = "touchedAt";

function getSessionSecrets(): string[] {
  const secret = process.env.SESSION_SECRET;
  if (secret) {
    return [secret];
  }

  if (process.env.NODE_ENV === "production") {
    console.warn(
      "SESSION_SECRET is not set. Set it in Vercel env vars for secure sessions.",
    );
  }

  return ["dev-only-change-me"];
}

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__solenis_session",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: getSessionSecrets(),
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
});

export const { getSession, commitSession, destroySession } = sessionStorage;

/** True when the session should get a new Max-Age (login or throttled refresh). */
export function shouldRefreshSessionTouch(
  touchedAt: unknown,
  nowMs = Date.now(),
): boolean {
  if (typeof touchedAt !== "number" || !Number.isFinite(touchedAt)) {
    return true;
  }
  return nowMs - touchedAt >= SESSION_REFRESH_INTERVAL_SECONDS * 1000;
}

/**
 * If the user is signed in and the last touch is old enough, rewrite the
 * session cookie with a fresh 7-day Max-Age. Returns Set-Cookie headers
 * only when a refresh actually happens.
 */
export async function maybeExtendSession(
  request: Request,
  nowMs = Date.now(),
): Promise<Headers | null> {
  const session = await getSession(request.headers.get("Cookie"));
  const sessionUser = session.get("user") as { id?: string } | undefined;
  if (!sessionUser?.id) {
    return null;
  }

  if (!shouldRefreshSessionTouch(session.get(SESSION_TOUCHED_AT_KEY), nowMs)) {
    return null;
  }

  session.set(SESSION_TOUCHED_AT_KEY, nowMs);
  return new Headers({
    "Set-Cookie": await commitSession(session),
  });
}
