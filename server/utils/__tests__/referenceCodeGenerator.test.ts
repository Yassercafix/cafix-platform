/**
 * Reference Code Generator Tests
 * Verifies that the generator matches the final specification
 */

import { describe, test, expect } from "vitest";
import {
  OWNER_REFERENCE_CODE,
  MAX_MARKETER_DEPTH,
  getMarketerDepth,
  isMarketerCode,
  isCafeteriaCode,
  getEntityTypeFromCode,
  getParentCode,
  isValidReferenceCode,
  EntityType,
} from "../referenceCodeGenerator";

describe("Reference Code Generator - Specification Compliance", () => {
  describe("Cafeteria prefix must be 'P', not 'C'", () => {
    test("1001P01 is a cafeteria code", () => {
      expect(isCafeteriaCode("1001P01")).toBe(true);
    });

    test("1001C01 (old format) is NOT a cafeteria code", () => {
      expect(isCafeteriaCode("1001C01")).toBe(false);
    });
  });

  describe("Marketer depth must be max 3", () => {
    test("10010101 (depth 3) is valid", () => {
      expect(isValidReferenceCode("10010101")).toBe(true);
    });

    test("1001010101 (depth 4) is INVALID", () => {
      expect(isValidReferenceCode("1001010101")).toBe(false);
    });

    test("MAX_MARKETER_DEPTH is 3", () => {
      expect(MAX_MARKETER_DEPTH).toBe(3);
    });
  });

  describe("All specification examples are valid", () => {
    test("Owner code 10 is valid", () => {
      expect(isValidReferenceCode("10")).toBe(true);
    });

    test("Marketer L1 code 1001 is valid", () => {
      expect(isValidReferenceCode("1001")).toBe(true);
    });

    test("Marketer L2 code 100101 is valid", () => {
      expect(isValidReferenceCode("100101")).toBe(true);
    });

    test("Marketer L3 code 10010101 is valid", () => {
      expect(isValidReferenceCode("10010101")).toBe(true);
    });

    test("Cafeteria code 1001P01 is valid", () => {
      expect(isValidReferenceCode("1001P01")).toBe(true);
    });

    test("Table code 1001P01T01 is valid", () => {
      expect(isValidReferenceCode("1001P01T01")).toBe(true);
    });

    test("Waiter code 1001P01W01 is valid", () => {
      expect(isValidReferenceCode("1001P01W01")).toBe(true);
    });

    test("Chef code 1001P01K01 is valid", () => {
      expect(isValidReferenceCode("1001P01K01")).toBe(true);
    });
  });

  describe("Parent code extraction", () => {
    test("Parent of 1001 is 10", () => {
      expect(getParentCode("1001")).toBe("10");
    });

    test("Parent of 100101 is 1001", () => {
      expect(getParentCode("100101")).toBe("1001");
    });

    test("Parent of 1001P01 is 1001", () => {
      expect(getParentCode("1001P01")).toBe("1001");
    });

    test("Parent of 100101P01 is 100101", () => {
      expect(getParentCode("100101P01")).toBe("100101");
    });
  });

  describe("Marketer depth helpers", () => {
    test("Depth of 10 is 0", () => {
      expect(getMarketerDepth("10")).toBe(0);
    });

    test("Depth of 1001 is 1", () => {
      expect(getMarketerDepth("1001")).toBe(1);
    });

    test("Depth of 100101 is 2", () => {
      expect(getMarketerDepth("100101")).toBe(2);
    });

    test("Depth of 10010101 is 3", () => {
      expect(getMarketerDepth("10010101")).toBe(3);
    });
  });
});
