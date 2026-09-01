import assert from "node:assert/strict";
import { test } from "node:test";

import { combineHeaders } from "./headers.ts";
import { createToastHeaders, getToast } from "./toast.server.ts";

test("combineHeaders appends multiple set-cookie values", () => {
  const headers = combineHeaders(
    { "set-cookie": "a=1" },
    { "set-cookie": "b=2" },
  );
  assert.deepEqual(headers.getSetCookie(), ["a=1", "b=2"]);
});

test("createToastHeaders and getToast flash a toast for one request", async () => {
  const headers = await createToastHeaders({
    description: "Question added",
    type: "success",
  });
  const setCookie = headers.get("set-cookie");
  assert.ok(setCookie);
  const request = new Request("https://example.com", {
    headers: { cookie: setCookie.split(";")[0] ?? "" },
  });

  const first = await getToast(request);
  assert.equal(first.toast?.description, "Question added");
  assert.equal(first.toast?.type, "success");
  assert.ok(first.headers?.get("set-cookie"));

  const clearedCookie = first.headers?.get("set-cookie")?.split(";")[0] ?? "";
  const second = await getToast(
    new Request("https://example.com", {
      headers: { cookie: clearedCookie },
    }),
  );
  assert.equal(second.toast, null);
});
