import { describe, it, expect } from "vitest";
import { truncateIpForAudit } from "./ip";

describe("truncateIpForAudit", () => {
  describe("IPv4", () => {
    it("zeros the last octet", () => {
      expect(truncateIpForAudit("192.168.1.45")).toBe("192.168.1.0");
      expect(truncateIpForAudit("10.0.0.255")).toBe("10.0.0.0");
      expect(truncateIpForAudit("8.8.8.8")).toBe("8.8.8.0");
    });

    it("strips a trailing port before truncating", () => {
      expect(truncateIpForAudit("192.168.1.45:8080")).toBe("192.168.1.0");
    });

    it("returns null for malformed octet ranges", () => {
      // 999 is out of range — defensive null instead of bogus pass-through.
      expect(truncateIpForAudit("999.168.1.45")).toBeNull();
    });
  });

  describe("IPv6", () => {
    it("keeps first 4 hextets, appends ::0", () => {
      expect(
        truncateIpForAudit("2001:0db8:85a3:0000:0000:8a2e:0370:7334")
      ).toBe("2001:0db8:85a3:0000::0");
    });

    it("handles short hextets", () => {
      expect(truncateIpForAudit("2001:db8:abcd:12:0:0:0:1")).toBe(
        "2001:db8:abcd:12::0"
      );
    });

    it("returns null for non-hex content", () => {
      expect(truncateIpForAudit("zzzz:db8:abcd:12::1")).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("returns null for null/undefined/empty", () => {
      expect(truncateIpForAudit(null)).toBeNull();
      expect(truncateIpForAudit(undefined)).toBeNull();
      expect(truncateIpForAudit("")).toBeNull();
    });

    it("returns null for unparseable strings", () => {
      expect(truncateIpForAudit("not-an-ip")).toBeNull();
      expect(truncateIpForAudit("192.168")).toBeNull();
    });
  });
});
