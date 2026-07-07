import { describe, expect, it } from "vitest";
import {
  advisorSignInPanelDescription,
  clientSignInPanelDescription,
  coerceSignInRoleForBrandedPortal,
  signInHubDescription,
} from "./sign-in-copy";
import { getVisibleSignInRoles } from "./sign-in-roles";

describe("sign-in copy", () => {
  it("includes firm name in client instructions on branded portals", () => {
    expect(clientSignInPanelDescription("Belvedere Risk")).toContain(
      "your Belvedere Risk advisor used",
    );
  });

  it("includes firm name in advisor instructions on branded portals", () => {
    expect(advisorSignInPanelDescription("Belvedere Risk")).toContain(
      "Belvedere Risk advisor workspace",
    );
  });

  it("uses platform-default copy without a firm name", () => {
    expect(clientSignInPanelDescription()).toContain("your advisor used");
    expect(signInHubDescription()).toContain("Choose your account type");
  });

  it("maps admin role to advisor on branded portals", () => {
    expect(coerceSignInRoleForBrandedPortal("admin")).toBe("advisor");
    expect(coerceSignInRoleForBrandedPortal("client")).toBe("client");
  });

  it("hides the Platform tab on branded portals", () => {
    const roles = getVisibleSignInRoles({ hidePlatform: true });
    expect(roles.map((role) => role.id)).toEqual(["client", "advisor"]);
  });
});
