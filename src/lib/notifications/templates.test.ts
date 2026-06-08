import { describe, expect, it } from "vitest";
import { buildNotificationTemplateData, renderNotificationEmail } from "./templates";

const APP_URL = "https://app.akilirisk.com";

describe("buildNotificationTemplateData", () => {
  it("supplies milestoneName from title for milestone notifications", () => {
    const data = buildNotificationTemplateData(
      "milestone",
      {
        title: "Governance pillar complete",
        message: "Alex Client has completed Governance pillar complete",
        referenceId: "client-1",
      },
      APP_URL
    );

    expect(data).toMatchObject({
      clientName: "Alex Client",
      milestoneName: "Governance pillar complete",
      clientDetailUrl: "https://app.akilirisk.com/advisor/pipeline/client-1",
    });
  });

  it("renders milestone email without throwing when template data is auto-built", () => {
    const data = buildNotificationTemplateData(
      "milestone",
      {
        title: "Your Risk Preview is ready",
        message: "Your questionnaire is complete and a Risk Preview is now viewable.",
      },
      APP_URL
    );

    expect(() => renderNotificationEmail("milestone", data)).not.toThrow();
    const html = renderNotificationEmail("milestone", data);
    expect(html).toContain("Your Risk Preview is ready");
  });

  it("parses client name from registration messages", () => {
    const data = buildNotificationTemplateData(
      "registration",
      {
        title: "New Client Registered",
        message: "Jordan Smith (jordan@example.com) has registered from your invitation",
      },
      APP_URL
    );

    expect(data).toMatchObject({
      clientName: "Jordan Smith",
      pipelineUrl: "https://app.akilirisk.com/advisor/pipeline",
    });
  });
});
