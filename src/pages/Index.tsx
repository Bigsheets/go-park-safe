import { evaluateParking } from "@/lib/parkingRules";
import { useState } from "react";
import { MapPin, Loader2 } from "lucide-react";
import ParkingResult from "@/components/ParkingResult";

type ParkingStatus = "allowed" | "risky" | "not_allowed";

interface ParkingInfo {
  status: ParkingStatus;
  title: string;
  explanation: string;
  lat?: number;
  lng?: number;
}

interface ParkingLog {
  signType: "no_parking" | "max_3h" | "permit_only" | "unknown";
  notes?: string;
  lat?: number;
  lng?: number;
  createdAt: string;
}

function findNearbyLog(lat: number, lng: number): ParkingLog | null {
  const logs: ParkingLog[] = JSON.parse(localStorage.getItem("parking_logs") || "[]");

  if (!logs.length) return null;

  const maxDistance = 0.0001;

  const nearbyLog = logs.find((log) => {
    if (typeof log.lat !== "number" || typeof log.lng !== "number") return false;

    const latDiff = Math.abs(log.lat - lat);
    const lngDiff = Math.abs(log.lng - lng);

    return latDiff <= maxDistance && lngDiff <= maxDistance;
  });

  return nearbyLog ?? null;
}

const Index = () => {
  const [result, setResult] = useState<ParkingInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const handleCheck = () => {
    setLoading(true);
    setLocationError(null);
    setResult(null);

    if (!navigator.geolocation) {
      setLocationError("Location not supported by your browser.");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setTimeout(() => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;

          const nearbyLog = findNearbyLog(lat, lng);

          const parkingResult = evaluateParking({
            lat,
            lng,
            loggedRule: nearbyLog
              ? {
                  type: nearbyLog.signType,
                  verified: false,
                  notes: nearbyLog.notes,
                }
              : null,
          });

          setResult({
            status: parkingResult.status,
            title: parkingResult.title,
            explanation: parkingResult.explanation,
            lat: parkingResult.lat,
            lng: parkingResult.lng,
          });

          setLoading(false);
        }, 800);
      },
      () => {
        setLocationError("Could not get your location. Please enable GPS.");
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleReset = () => {
    setResult(null);
    setLocationError(null);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-between px-5 py-8 safe-area-inset">
      <div className="text-center pt-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4">
          <MapPin className="w-7 h-7 text-primary-foreground" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Can I Park Here?</h1>
        <p className="text-muted-foreground mt-1 text-base">
          Instant parking guidance at your location
        </p>
      </div>

      <div className="w-full max-w-sm flex flex-col items-center gap-6 -mt-8">
        {result ? (
          <ParkingResult info={result} onReset={handleReset} />
        ) : (
          <>
            <button
              onClick={handleCheck}
              disabled={loading}
              className="w-full py-5 rounded-2xl bg-primary text-primary-foreground text-xl font-semibold shadow-lg active:scale-[0.97] transition-transform disabled:opacity-70 flex items-center justify-center gap-3"
            >
              {loading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Checking…
                </>
              ) : (
                "Check Parking Here"
              )}
            </button>

            {locationError && (
              <p className="text-destructive text-sm text-center">{locationError}</p>
            )}
          </>
        )}
      </div>

      <footer className="text-center pb-4 space-y-2">
        <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
          This is guidance only. Always follow posted signs.
        </p>
      </footer>
    </div>
  );
};

export default Index;
