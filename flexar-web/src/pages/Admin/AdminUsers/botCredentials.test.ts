import { describe, expect, it } from "vitest";

import { downloadZuliprc, formatBotEmail } from "./botCredentials";

describe("formatBotEmail", () => {
  it("strips protocol and path from the realm URL", () => {
    expect(formatBotEmail("foo", "https://chat.example.com/")).toBe(
      "foo-bot@chat.example.com",
    );
    expect(formatBotEmail("foo", "https://chat.example.com:8443/path")).toBe(
      "foo-bot@chat.example.com:8443",
    );
  });

  it("falls back to a sentinel host when realm URL is missing", () => {
    expect(formatBotEmail("foo", undefined)).toBe("foo-bot@zulipchat.com");
    expect(formatBotEmail("foo", "")).toBe("foo-bot@zulipchat.com");
  });

  it("uses the raw string when realm URL is not a valid URL", () => {
    expect(formatBotEmail("foo", "not-a-url")).toBe("foo-bot@not-a-url");
  });
});

describe("downloadZuliprc", () => {
  it("returns a valid INI body with email/key/site keys", () => {
    const body = downloadZuliprc({
      email: "llm-bot@chat.example.com",
      apiKey: "sk-abc",
      shortName: "llm",
      realmUrl: "https://chat.example.com",
    });
    expect(body).toBe(
      "[api]\n" +
        "email=llm-bot@chat.example.com\n" +
        "key=sk-abc\n" +
        "site=https://chat.example.com\n",
    );
  });

  it("falls back to https://localhost when realmUrl is missing", () => {
    const body = downloadZuliprc({
      email: "x@y",
      apiKey: "k",
      shortName: "x",
      realmUrl: undefined,
    });
    expect(body).toMatch(/site=https:\/\/localhost/);
  });
});
