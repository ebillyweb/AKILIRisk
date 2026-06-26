import { describe, it, expect } from "vitest";
import { InvalidTransitionError, SOLUTION_ACTIONS } from "./solution-lifecycle";

describe("InvalidTransitionError", () => {
  it("includes from and to in message", () => {
    const err = new InvalidTransitionError("COMPLETED", "PENDING");
    expect(err.message).toBe("Cannot transition from COMPLETED to PENDING");
    expect(err.name).toBe("InvalidTransitionError");
  });
});

describe("SOLUTION_ACTIONS", () => {
  it("has an action constant for each lifecycle status", () => {
    expect(SOLUTION_ACTIONS.STATUS_PENDING).toBe("status_pending");
    expect(SOLUTION_ACTIONS.STATUS_REVIEWED).toBe("status_reviewed");
    expect(SOLUTION_ACTIONS.STATUS_ACCEPTED).toBe("status_accepted");
    expect(SOLUTION_ACTIONS.STATUS_DECLINED).toBe("status_declined");
    expect(SOLUTION_ACTIONS.STATUS_COMPLETED).toBe("status_completed");
    expect(SOLUTION_ACTIONS.MILESTONE_UPDATE).toBe("milestone_update");
  });

  it("uses lowercase status names consistently", () => {
    const statusActions = Object.entries(SOLUTION_ACTIONS)
      .filter(([k]) => k.startsWith("STATUS_"))
      .map(([, v]) => v);

    for (const action of statusActions) {
      expect(action).toMatch(/^status_[a-z]+$/);
    }
  });
});
