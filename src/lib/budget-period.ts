export interface PeriodRange {
  from: Date;
  to: Date;
}

function advancePeriod(date: Date, period: string): Date {
  const d = new Date(date);
  switch (period) {
    case "WEEKLY":
      d.setDate(d.getDate() + 7);
      break;
    case "QUARTERLY":
      d.setMonth(d.getMonth() + 3);
      break;
    case "YEARLY":
      d.setFullYear(d.getFullYear() + 1);
      break;
    case "MONTHLY":
    default:
      d.setMonth(d.getMonth() + 1);
      break;
  }
  return d;
}

/**
 * Returns the [from, to) window for the budget cycle that contains `now`,
 * anchored on the budget's own `startDate` — not the calendar month. A
 * MONTHLY budget started on the 15th rolls over on the 15th of each month,
 * not on the 1st. `to` is an exclusive upper bound (use `lt`, not `lte`, in
 * the transaction-date filter).
 */
export function getPeriodRange(
  period: string,
  startDate: Date,
  now: Date = new Date()
): PeriodRange {
  let cycleStart = new Date(startDate);
  let next = advancePeriod(cycleStart, period);

  while (next <= now) {
    cycleStart = next;
    next = advancePeriod(cycleStart, period);
  }

  return { from: cycleStart, to: next };
}
