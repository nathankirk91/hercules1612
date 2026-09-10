import { createCookieSessionStorage } from "react-router";

/** Keep users signed in across browser restarts (30 days). */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

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
