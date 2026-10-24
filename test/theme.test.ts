import assert from "node:assert/strict";
import { test } from "node:test";
import { isThemeSetting, nextThemeSetting, resolveScheme } from "../src/core/theme.ts";

test("the setting cycles System, Light, Dark and a stored value is checked", () => {
  assert.equal(nextThemeSetting("system"), "light");
  assert.equal(nextThemeSetting("light"), "dark");
  assert.equal(nextThemeSetting("dark"), "system");
  assert.equal(isThemeSetting("dark"), true);
  assert.equal(isThemeSetting("auto"), false);
  assert.equal(isThemeSetting(null), false);
});

test("System follows the phone, light when it does not say, and a choice wins over the phone", () => {
  assert.equal(resolveScheme("system", "dark"), "dark");
  assert.equal(resolveScheme("system", "light"), "light");
  assert.equal(resolveScheme("system", null), "light");
  assert.equal(resolveScheme("system", undefined), "light");
  assert.equal(resolveScheme("light", "dark"), "light");
  assert.equal(resolveScheme("dark", "light"), "dark");
});
