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

  it("parses enterprise intent", () => {
    expect(parseContactFormIntent("enterprise")).toBe("enterprise");
  });

  it("returns enterprise preset copy", () => {
    const preset = getContactFormIntentPreset("enterprise");
    expect(preset?.subject).toMatch(/Enterprise plan/i);
    expect(preset?.message).toMatch(/advisors/i);
  });
});
