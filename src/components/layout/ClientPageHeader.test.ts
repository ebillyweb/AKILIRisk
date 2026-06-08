import { describe, expect, it } from "vitest";
import { getClientPageHeaderConfig } from "@/components/layout/client-page-header-config";

describe("getClientPageHeaderConfig", () => {
  it("matches intake and assessment sub-routes", () => {
    expect(getClientPageHeaderConfig("/intake")?.title).toBe(
      "Family Governance Intake"
    );
    expect(getClientPageHeaderConfig("/intake/interview")?.title).toBe(
      "Family Governance Intake"
    );
    expect(getClientPageHeaderConfig("/intake/complete")?.title).toBe(
      "Family Governance Intake"
    );
    expect(getClientPageHeaderConfig("/assessment")?.title).toBe(
      "Governance Assessment"
    );
    expect(getClientPageHeaderConfig("/assessment/cyber-risk/2")?.title).toBe(
      "Governance Assessment"
    );
  });

  it("does not match unrelated routes", () => {
    expect(getClientPageHeaderConfig("/advisor/clients")).toBeNull();
  });

  it("uses waived intake copy on the landing page when flagged", () => {
    expect(
      getClientPageHeaderConfig("/intake", { intakeWaivedOnLanding: true })?.title
    ).toBe("Intake not required");
    expect(
      getClientPageHeaderConfig("/intake/interview", { intakeWaivedOnLanding: true })
        ?.title
    ).toBe("Family Governance Intake");
  });
});
