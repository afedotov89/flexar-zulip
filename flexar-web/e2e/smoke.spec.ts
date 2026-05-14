import { test, expect } from "@playwright/test";

test("scaffold page renders", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Flexar Hub Web");
  await expect(page.getByText("Flexar Hub Web — scaffold OK")).toBeVisible();
});
