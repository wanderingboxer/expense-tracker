import { getPeriodRange } from "@/lib/budget-period";

describe("getPeriodRange", () => {
  it("MONTHLY budget started on the 15th rolls over on the 15th, not the calendar month", () => {
    const startDate = new Date("2026-01-15T00:00:00Z");
    const now = new Date("2026-08-20T12:00:00Z"); // after the 15th of August

    const { from, to } = getPeriodRange("MONTHLY", startDate, now);

    expect(from.toISOString().slice(0, 10)).toBe("2026-08-15");
    expect(to.toISOString().slice(0, 10)).toBe("2026-09-15");
  });

  it("MONTHLY budget: 'now' before the 15th falls in the previous cycle", () => {
    const startDate = new Date("2026-01-15T00:00:00Z");
    const now = new Date("2026-08-10T12:00:00Z"); // before the 15th

    const { from, to } = getPeriodRange("MONTHLY", startDate, now);

    expect(from.toISOString().slice(0, 10)).toBe("2026-07-15");
    expect(to.toISOString().slice(0, 10)).toBe("2026-08-15");
  });

  it("WEEKLY budget rolls over every 7 days from startDate, not from Sunday", () => {
    const startDate = new Date("2026-06-03T00:00:00Z"); // a Wednesday
    const now = new Date("2026-06-20T00:00:00Z");

    const { from, to } = getPeriodRange("WEEKLY", startDate, now);

    // Cycles: 6/3, 6/10, 6/17, 6/24 — 6/20 falls in the 6/17-6/24 cycle.
    expect(from.toISOString().slice(0, 10)).toBe("2026-06-17");
    expect(to.toISOString().slice(0, 10)).toBe("2026-06-24");
  });

  it("QUARTERLY budget anchors on startDate's month, not calendar quarters", () => {
    const startDate = new Date("2026-02-01T00:00:00Z");
    const now = new Date("2026-09-15T00:00:00Z");

    const { from, to } = getPeriodRange("QUARTERLY", startDate, now);

    // Cycles: 2/1, 5/1, 8/1, 11/1 — 9/15 falls in the 8/1-11/1 cycle.
    expect(from.toISOString().slice(0, 10)).toBe("2026-08-01");
    expect(to.toISOString().slice(0, 10)).toBe("2026-11-01");
  });

  it("YEARLY budget anchors on startDate's month/day", () => {
    const startDate = new Date("2024-03-10T00:00:00Z");
    const now = new Date("2026-08-01T00:00:00Z");

    const { from, to } = getPeriodRange("YEARLY", startDate, now);

    expect(from.toISOString().slice(0, 10)).toBe("2026-03-10");
    expect(to.toISOString().slice(0, 10)).toBe("2027-03-10");
  });

  it("a budget with a future startDate produces a window that hasn't started yet", () => {
    const startDate = new Date("2027-01-01T00:00:00Z");
    const now = new Date("2026-08-01T00:00:00Z");

    const { from, to } = getPeriodRange("MONTHLY", startDate, now);

    expect(from.toISOString().slice(0, 10)).toBe("2027-01-01");
    expect(to.toISOString().slice(0, 10)).toBe("2027-02-01");
  });
});
