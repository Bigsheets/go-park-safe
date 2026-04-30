import { useState } from "react";
import { MapPin, ShieldCheck, BookOpen } from "lucide-react";
import ParkingFlow from "@/components/ParkingFlow";

const Index = () => {
  const [flowOpen, setFlowOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background px-5 py-8 safe-area-inset">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-sm flex-col justify-between">
        <div className="space-y-6">
          {/* Header */}
          <div className="pt-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary shadow-lg">
              <MapPin className="h-8 w-8 text-primary-foreground" />
            </div>

            <h1 className="text-3xl font-bold tracking-tight">Go Park Safe</h1>
            <p className="mt-2 text-base text-muted-foreground">
              Quick parking decisions for Cambridge, Ontario
            </p>
          </div>

          {flowOpen ? (
            <ParkingFlow onExit={() => setFlowOpen(false)} />
          ) : (
            <>
              {/* Primary action */}
              <button
                onClick={() => setFlowOpen(true)}
                className="flex w-full items-center justify-center gap-3 rounded-3xl bg-primary px-5 py-5 text-xl font-semibold text-primary-foreground shadow-lg transition-transform active:scale-[0.98]"
              >
                <MapPin className="h-6 w-6" />
                Check if I can park here
              </button>

              <p className="text-center text-xs text-muted-foreground">
                Tap-based · Takes about 15 seconds
              </p>

              {/* Secondary: Learn rules */}
              <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-muted">
                    <BookOpen className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-base font-semibold tracking-tight">
                      Learn parking rules
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Cambridge limits on-street parking to 3 hours unless
                      otherwise posted. From Jan 1 – Mar 15, no on-street
                      parking 2:30–6:00 AM.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-muted/50 px-4 py-3">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <p className="text-xs leading-5 text-muted-foreground">
                    Guidance only. Always check posted signs, snow event rules,
                    and permit requirements before parking.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {!flowOpen && (
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
