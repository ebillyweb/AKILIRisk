import { describe, expect, it, vi } from "vitest";
import { logResendResult } from "./log-resend-result";

describe("logResendResult", () => {
  it("returns true when Resend reports success", () => {
    expect(logResendResult("password-reset", { data: { id: "msg_1" }, error: null })).toBe(
      true,
    );
  });

  it("logs and returns false when Resend reports an error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const ok = logResendResult("password-reset", {
      data: null,
      error: { message: "Invalid recipient", name: "validation_error" },
    });
    expect(ok).toBe(false);
    expect(spy).toHaveBeenCalledWith(
      "Resend API error (password-reset):",
      expect.objectContaining({ message: "Invalid recipient" }),
    );
    spy.mockRestore();
  });
});
