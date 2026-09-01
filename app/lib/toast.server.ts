import { createCookieSessionStorage, data, redirect } from "react-router";
import { z } from "zod";

import { combineHeaders } from "./headers.ts";

export const toastKey = "toast";

const ToastSchema = z.object({
  description: z.string(),
  id: z.string().default(() => crypto.randomUUID()),
  title: z.string().optional(),
  type: z.enum(["message", "success", "error"]).default("message"),
});

export type Toast = z.infer<typeof ToastSchema>;
export type ToastInput = z.input<typeof ToastSchema>;

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

export const toastSessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__solenis_toast",
    sameSite: "lax",
    path: "/",
    httpOnly: true,
    secrets: getSessionSecrets(),
    secure: process.env.NODE_ENV === "production",
  },
});

export async function redirectWithToast(
  url: string,
  toast: ToastInput,
  init?: ResponseInit,
) {
  return redirect(url, {
    ...init,
    headers: combineHeaders(init?.headers, await createToastHeaders(toast)),
  });
}

export async function createToastHeaders(toastInput: ToastInput) {
  const session = await toastSessionStorage.getSession();
  const toast = ToastSchema.parse(toastInput);
  session.flash(toastKey, toast);
  const cookie = await toastSessionStorage.commitSession(session);
  return new Headers({ "set-cookie": cookie });
}

export async function dataWithToast<T>(
  dataToReturn: T,
  toast: ToastInput,
  init?: ResponseInit,
) {
  return data(dataToReturn, {
    ...init,
    headers: combineHeaders(init?.headers, await createToastHeaders(toast)),
  });
}

export async function getToast(request: Request) {
  const session = await toastSessionStorage.getSession(
    request.headers.get("cookie"),
  );
  const result = ToastSchema.safeParse(session.get(toastKey));
  const toast = result.success ? result.data : null;
  return {
    toast,
    headers: toast
      ? new Headers({
          "set-cookie": await toastSessionStorage.destroySession(session),
        })
      : null,
  };
}
