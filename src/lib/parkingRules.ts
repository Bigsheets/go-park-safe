// src/lib/parkingRules.ts

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
  loggedRule?: {
    type: "no_parking" | "max_3h" | "permit_only" | "unknown";
    verified?: boolean;
    notes?: string;
  } | null;
}

export function evaluateParking(context: ParkingContext): ParkingInfo {
  const now = context.now ?? new Date();
  const hour = now.getHours();

  // Hard rule: overnight window
  if (hour >= 2 && hour < 6) {
    return {
      status: "not_allowed",
      title: "No Parking Right Now",
      explanation:
        "A city-wide overnight restriction may apply between 2 AM and 6 AM. Move your car to avoid a ticket.",
      confidence: "medium",
      lat: context.lat,
      lng: context.lng,
    };
  }

  // If user/community data exists, use it
  if (context.loggedRule) {
    if (context.loggedRule.type === "no_parking") {
      return {
        status: "not_allowed",
        title: "No Parking Reported Here",
        explanation:
          "A nearby no-parking restriction has been logged for this location. Check the posted sign to confirm the exact hours.",
        confidence: context.loggedRule.verified ? "high" : "medium",
        lat: context.lat,
        lng: context.lng,
      };
    }

    if (context.loggedRule.type === "max_3h") {
      return {
        status: "risky",
        title: "3-Hour Limit Reported Here",
        explanation:
          "Community or verified sign data suggests a 3-hour parking limit on this block. Check posted signs before leaving your car.",
        confidence: context.loggedRule.verified ? "high" : "medium",
        lat: context.lat,
        lng: context.lng,
      };
    }

    if (context.loggedRule.type === "permit_only") {
      return {
        status: "not_allowed",
        title: "Permit Parking Reported Here",
        explanation:
          "This block may require a permit. Confirm the posted sign before parking.",
        confidence: context.loggedRule.verified ? "high" : "medium",
        lat: context.lat,
        lng: context.lng,
      };
    }
  }

  // No block-level sign data yet
  return {
    status: "risky",
    title: "Check Signs Before Parking",
    explanation:
      "No city-wide restriction was found right now, but this result does not yet include exact street signs or curb rules for this block.",
    confidence: "low",
    lat: context.lat,
    lng: context.lng,
  };
}
