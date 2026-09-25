import { expect, test } from "@playwright/test";

test.describe("permits section nav", () => {
  test("permits hub redirects unauthenticated users to login", async ({
    page,
  }) => {
    await page.goto("/permits/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("permits records redirects unauthenticated users to login", async ({
    page,
  }) => {
    await page.goto("/permits/history");
    await expect(page).toHaveURL(/\/login/);
  });

  test("permits manage redirects unauthenticated users to login", async ({
    page,
  }) => {
    await page.goto("/permits/manage");
    await expect(page).toHaveURL(/\/login/);
  });

  test("permits settings redirects unauthenticated users to login", async ({
    page,
  }) => {
    await page.goto("/permits/settings");
    await expect(page).toHaveURL(/\/login/);
  });
});
