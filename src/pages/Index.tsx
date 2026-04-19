import { evaluateParking } from "@/lib/parkingRules";
import { useState } from "react";
import { MapPin, Loader2 } from "lucide-react";
import ParkingResult from "@/components/ParkingResult";
import { supabase } from "@/integrations/supabase/client";

type ParkingStatus = "allowed" | "risky" | "not_allowed";
type SignType = "no_parking" | "max_3h" | "permit_only" | "unknown";

interface ParkingInfo {
  status: ParkingStatus;
  title: string;
  explanation: string;
  lat?: number;
  lng?: number;
}

interface NearbyReport {
  signType: SignType;
  notes?: string | null;
}

async function findNearbyReport(lat: number, lng: number): Promise<NearbyReport | null> {
  const delta = 0.0001; // ~30m bounding box
  const { data, error } = await supabase
    .from("parking_reports")
    .select("sign_type, notes, lat, lng")
    .gte("lat", lat - delta)
    .lte("lat", lat + delta)
    .gte("lng", lng - delta)
    .lte("lng", lng + delta)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) return null;

  return {
    signType: data[0].sign_type as SignType,
    notes: data[0].notes,
  };
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
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        const nearbyReport = await findNearbyReport(lat, lng);

        const parkingResult = evaluateParking({
          lat,
          lng,
          loggedRule: nearbyReport
            ? {
                type: nearbyReport.signType,
                verified: false,
                notes: nearbyReport.notes ?? undefined,
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
