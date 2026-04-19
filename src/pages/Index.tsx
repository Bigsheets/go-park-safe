import { evaluateParking } from "@/lib/parkingRules";
import { useState } from "react";
import { MapPin, Loader2, ShieldCheck } from "lucide-react";
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
  const delta = 0.0001;

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
    <div className="min-h-screen bg-background px-5 py-8 safe-area-inset">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-sm flex-col justify-between">
        <div className="space-y-6">
          {/* Header */}
          <div className="pt-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary shadow-lg">
              <MapPin className="h-8 w-8 text-primary-foreground" />
            </div>

            <h1 className="text-3xl font-bold tracking-tight">Can I Park Here?</h1>
            <p className="mt-2 text-base text-muted-foreground">
              Quick parking guidance for Cambridge streets
            </p>
          </div>

          {result ? (
            <ParkingResult info={result} onReset={handleReset} />
          ) : (
            <>
              {/* Intro Card */}
              <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-muted">
                    <ShieldCheck className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight">
                      Check before you park
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Get guidance based on Cambridge parking rules and nearby
                      user-reported restrictions.
                    </p>
                  </div>
                </div>
              </div>

              {/* Main Action */}
              <button
                onClick={handleCheck}
                disabled={loading}
                className="flex w-full items-center justify-center gap-3 rounded-3xl bg-primary px-5 py-5 text-xl font-semibold text-primary-foreground shadow-lg transition-transform active:scale-[0.98] disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-6 w-6 animate-spin" />
                    Checking…
                  </>
                ) : (
                  <>
                    <MapPin className="h-6 w-6" />
                    Check Parking Here
                  </>
                )}
              </button>

              {/* Error */}
              {locationError && (
                <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-center">
                  <p className="text-sm text-destructive">{locationError}</p>
                </div>
              )}

              {/* Small helper copy */}
              <div className="rounded-2xl bg-muted/50 px-4 py-3">
                <p className="text-xs leading-5 text-muted-foreground">
                  Results are guidance only. Always check posted signs, temporary
                  restrictions, snow event rules, and permit requirements.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!result && (
          <footer className="pt-8 text-center">
            <p className="text-xs text-muted-foreground">
              Built to make local parking rules easier to understand
            </p>
          </footer>
        )}
      </div>
    </div>
  );
};

export default Index;
