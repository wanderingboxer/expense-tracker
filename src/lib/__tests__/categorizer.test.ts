import { getDefaultCategories } from "@/lib/categorizer";

describe("getDefaultCategories", () => {
  const categories = getDefaultCategories();

  it("returns an array", () => {
    expect(Array.isArray(categories)).toBe(true);
    expect(categories.length).toBeGreaterThan(0);
  });

  it('includes "Food & Dining"', () => {
    expect(categories.some((c) => c.name === "Food & Dining")).toBe(true);
  });

  it('includes "Groceries"', () => {
    expect(categories.some((c) => c.name === "Groceries")).toBe(true);
  });

  it('includes "Housing"', () => {
    expect(categories.some((c) => c.name === "Housing")).toBe(true);
  });

  it('includes "Transportation"', () => {
    expect(categories.some((c) => c.name === "Transportation")).toBe(true);
  });

  it('includes "Shopping"', () => {
    expect(categories.some((c) => c.name === "Shopping")).toBe(true);
  });

  it('"Food & Dining" has subcategories', () => {
    const food = categories.find((c) => c.name === "Food & Dining");
    expect(food).toBeDefined();
    expect(food!.children).toBeDefined();
    expect(food!.children!.length).toBeGreaterThan(0);
  });

  it("each category has name, icon, and color", () => {
    for (const cat of categories) {
      expect(cat.name).toBeTruthy();
      expect(cat.icon).toBeTruthy();
      expect(cat.color).toBeTruthy();
    }
  });
});
