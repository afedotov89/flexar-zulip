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

  describe("transport-level codes (no server body)", () => {
    it("translates NETWORK_ERROR — never leaks raw browser text like 'Failed to fetch'", () => {
      // sendRequest wraps fetch's TypeError as
      // `ApiError("Failed to fetch", "NETWORK_ERROR", 0)` with NO body.
      const err = new ApiError("Failed to fetch", "NETWORK_ERROR", 0);
      const text = describeApiError(err);
      expect(text).not.toContain("Failed to fetch");
      expect(text).toMatch(/Не удалось связаться с сервером/);
    });

    it("translates TIMEOUT", () => {
      const err = new ApiError(
        "Request to /messages/flags timed out after 30000ms.",
        "TIMEOUT",
        0,
      );
      expect(describeApiError(err)).toMatch(/Сервер не ответил вовремя/);
    });

    it("translates ABORTED", () => {
      const err = new ApiError("Request was aborted.", "ABORTED", 0);
      expect(describeApiError(err)).toMatch(/Запрос был отменён/);
    });

    it("translates MISSING_CREDENTIALS", () => {
      const err = new ApiError(
        "Cannot make an authenticated request without credentials.",
        "MISSING_CREDENTIALS",
        0,
      );
      expect(describeApiError(err)).toMatch(/Сессия истекла/);
    });

    it("falls back for an unknown transport code", () => {
      const err = new ApiError("???", "UNKNOWN_CODE", 0);
      expect(describeApiError(err)).toBe("Не удалось выполнить действие.");
    });
  });
});
