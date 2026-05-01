export function inWinterOvernight(date: Date) {
  const month = date.getMonth(); // 0 = Jan, 1 = Feb, 2 = Mar
  const day = date.getDate();

  const isWinterSeason =
    month === 0 || month === 1 || (month === 2 && day <= 15);

  if (!isWinterSeason) return false;

  const minutesAfterMidnight = date.getHours() * 60 + date.getMinutes();
  const banStarts = 2 * 60 + 30; // 2:30 AM
  const banEnds = 6 * 60; // 6:00 AM

  return minutesAfterMidnight >= banStarts && minutesAfterMidnight < banEnds;
}

export function deriveResult({
  nearHydrant,
  nearDriveway,
  hasSign,
}: {
  nearHydrant: boolean;
  nearDriveway: boolean;
  hasSign: boolean;
}) {
  if (nearHydrant || nearDriveway) {
    return {
      status: "no",
      message: "Do not park here",
      reason: "Too close to a fire hydrant or driveway",
      confidence: "high",
    };
  }

  if (hasSign) {
    return {
      status: "risky",
      message: "This spot may be restricted",
      reason: "Parking signs may apply (time limits or restrictions)",
      confidence: "medium",
    };
  }

  return {
    status: "yes",
    message: "You can likely park here",
    reason: "No obvious restrictions detected",
    confidence: "medium",
  };
}
