import {
  normalizeMerchantName,
  calculateMerchantSimilarity,
} from "@/lib/merchant-normalizer";

describe("normalizeMerchantName", () => {
  it('normalizes "SWIGGY INDIA PVT LTD"', () => {
    expect(normalizeMerchantName("SWIGGY INDIA PVT LTD")).toBe("Swiggy India");
  });

  it('normalizes "SWIGGY*ORDER" by removing special chars', () => {
    const result = normalizeMerchantName("SWIGGY*ORDER");
    // Asterisk is removed, words merge
    expect(result.toLowerCase()).toContain("swiggy");
  });

  it('normalizes "Amazon.in"', () => {
    expect(normalizeMerchantName("Amazon.in")).toBe("Amazon.In");
  });

  it('trims and normalizes "  UBER TRIP  "', () => {
    expect(normalizeMerchantName("  UBER TRIP  ")).toBe("Uber Trip");
  });

  it("removes transaction prefixes", () => {
    expect(normalizeMerchantName("POS-BIGBASKET")).toBe("Bigbasket");
  });
});

describe("calculateMerchantSimilarity", () => {
  it('"Swiggy" vs "SWIGGY" -> high similarity', () => {
    expect(calculateMerchantSimilarity("Swiggy", "SWIGGY")).toBe(1);
  });

  it('"Amazon" vs "Flipkart" -> low similarity', () => {
    expect(calculateMerchantSimilarity("Amazon", "Flipkart")).toBeLessThan(0.5);
  });

  it("identical strings -> 1", () => {
    expect(calculateMerchantSimilarity("test", "test")).toBe(1);
  });

  it("empty strings -> 1", () => {
    expect(calculateMerchantSimilarity("", "")).toBe(1);
  });
});
