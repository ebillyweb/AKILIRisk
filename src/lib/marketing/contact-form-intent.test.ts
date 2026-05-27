import { describe, expect, it } from "vitest";
import {
  getContactFormIntentPreset,
  parseContactFormIntent,
} from "@/lib/marketing/contact-form-intent";

describe("contact form intent", () => {
  it("parses demo intent", () => {
    expect(parseContactFormIntent("demo")).toBe("demo");
    expect(parseContactFormIntent(" DEMO ")).toBe("demo");
  });

  it("returns demo preset copy", () => {
    const preset = getContactFormIntentPreset("demo");
    expect(preset?.subject).toMatch(/demonstration/i);
    expect(preset?.message).toMatch(/advisor workspace/i);
  });
});
