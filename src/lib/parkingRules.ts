export type ParkingStatus = "allowed" | "risky" | "not_allowed";

export interface ParkingInfo {
  status: ParkingStatus;
  title: string;
  explanation: string;
  confidence: "low" | "medium" | "high";
  lat?: number;
  lng?: number;
}

export interface ParkingContext {
  lat: number;
  lng: number;
  now?: Date;
  hasNearbySignData?: boolean;
  isSnowEvent?: boolean;
  loggedRule?: {
    type: "no_parking" | "max_3h" | "permit_only" | "unknown";
    verified?: boolean;
    notes?: string;
  } | null;
}

function isWinterBanSeason(date: Date): boolean {
  const month = date.getMonth();
  const day = date.getDate();

  if (month === 0) return true;
  if (month === 1) return true;
  if (month === 2 && day <= 15) return true;

  return false;
}

function isBetween230And6(date: Date): boolean {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  const start = 2 * 60 + 30;
  const end = 6 * 60;

  return totalMinutes >= start && totalMinutes < end;
}

export function evaluateParking(context: ParkingContext): ParkingInfo {
  const now = context.now ?? new Date();
  const inWinterBanSeason = isWinterBanSeason(now);
  const inOvernightWindow = isBetween230And6(now);

  if (context.isSnowEvent) {
    return {
      status: "not_allowed",
      title: "No Parking During Snow Event",
      explanation:
        "Cambridge prohibits parking on all city streets at any time during a declared Snow Event until the event ends.",
      confidence: "high",
      lat: context.lat,
      lng: context.lng,
    };
  }

  if (inWinterBanSeason && inOvernightWindow) {
    return {
      status: "not_allowed",
      title: "No Overnight Winter Parking",
      explanation:
        "In Cambridge, from January 1 to March 15, on-street parking is not permitted citywide between 2:30 AM and 6:00 AM.",
      confidence: "high",
      lat: context.lat,
      lng: context.lng,
    };
  }

  if (context.loggedRule) {
    if (context.loggedRule.type === "no_parking") {
      return {
        status: "risky",
        title: "No Parking Rule Reported Nearby",
        explanation:
          "A posted no-parking rule was reported very close to this location. Check the nearby sign carefully before parking here.",
        confidence: context.loggedRule.verified ? "high" : "medium",
        lat: context.lat,
        lng: context.lng,
      };
    }

    if (context.loggedRule.type === "max_3h") {
      return {
        status: "risky",
        title: "3-Hour Parking Limit Reported Nearby",
        explanation:
          "A posted 3-hour parking limit was reported very close to this location. Check nearby signs before leaving your vehicle.",
        confidence: context.loggedRule.verified ? "high" : "medium",
        lat: context.lat,
        lng: context.lng,
      };
    }

    if (context.loggedRule.type === "permit_only") {
      return {
        status: "risky",
        title: "Permit Parking Reported Nearby",
        explanation:
          "Permit-only parking was reported very close to this location. Confirm the posted sign before parking here.",
        confidence: context.loggedRule.verified ? "high" : "medium",
        lat: context.lat,
        lng: context.lng,
      };
    }

    if (context.loggedRule.type === "unknown") {
      return {
        status: "risky",
        title: "Posted Restriction Reported Nearby",
        explanation:
          "A posted parking restriction was reported very close to this location. Check nearby signs carefully before parking.",
        confidence: "medium",
        lat: context.lat,
        lng: context.lng,
      };
    }
  }

  if (inWinterBanSeason) {
    return {
      status: "risky",
      title: "Parking May Be Allowed Right Now",
      explanation:
        "No citywide winter parking ban applies at this moment. In Cambridge, on-street parking is generally allowed for up to 3 hours unless otherwise posted. Always check nearby signs, core area limits, permits, and temporary restrictions.",
      confidence: "medium",
      lat: context.lat,
      lng: context.lng,
    };
  }

  return {
    status: "risky",
    title: "Check Signs Before Parking",
    explanation:
      "In Cambridge, on-street parking is generally limited to 3 hours unless otherwise posted. This app does not yet know exact sign rules, downtown core limits, permit zones, or temporary restrictions for this block.",
    confidence: "medium",
    lat: context.lat,
    lng: context.lng,
  };
}
