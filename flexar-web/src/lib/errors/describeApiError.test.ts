// Unit tests for `describeApiError` translation table.

import { describe, expect, it } from "vitest";
import { ApiError } from "../../api";
import { describeApiError } from "./describeApiError";

function apiError(msg: string): ApiError {
  return new ApiError(msg, "BAD_REQUEST", 400, {
    result: "error",
    msg,
    code: "BAD_REQUEST",
  });
}

describe("describeApiError", () => {
  it("translates a known edit-time-limit error", () => {
    const err = apiError("The time limit for editing this message has passed");
    expect(describeApiError(err)).toBe(
      "Время для редактирования сообщения истекло.",
    );
  });

  it("translates a substring match (server may decorate the phrase)", () => {
    const err = apiError(
      "status_text is too long (limit: 60 characters)",
    );
    expect(describeApiError(err)).toBe("Слишком длинный текст статуса.");
  });

  it("returns the server message verbatim for an untranslated phrase", () => {
    const err = apiError("Invalid stream id");
    expect(describeApiError(err)).toBe("Invalid stream id");
  });

  it("uses the fallback when the cause is not an Error", () => {
    expect(describeApiError(undefined)).toBe("Не удалось выполнить действие.");
    expect(describeApiError(undefined, "Своя подсказка.")).toBe(
      "Своя подсказка.",
    );
  });

  it("returns a non-empty Error.message when the cause is a plain Error", () => {
    expect(describeApiError(new Error("boom"))).toBe("boom");
  });
});
