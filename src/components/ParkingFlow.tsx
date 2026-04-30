import { useEffect, useState } from "react";
import {
  MapPin,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Camera,
  Clock3,
  Bell,
  CarFront,
} from "lucide-react";
import { toast } from "sonner";
import LocationMap from "./LocationMap";
import { supabase } from "@/integrations/supabase/client";

type Step = "location" | "q1" | "q2" | "q3" | "result" | "timer";
type ResultKind = "no" | "risky" | "ok";

interface FlowState {
  lat?: number;
  lng?: number;
  hydrant?: boolean;
  driveway?: boolean;
  sign?: boolean;
  resultKind?: ResultKind;
  resultTitle?: string;
  resultReason?: string;
  confidence?: "low" | "medium" | "high";
  isWinterRule?: boolean;
}

interface Props {
  onExit: () => void;
}

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

function inWinterOvernight(date: Date) {
  const month = date.getMonth();
  const day = date.getDate();
  const inSeason =
    month === 0 || month === 1 || (month === 2 && day <= 15);
  if (!inSeason) return false;
  const total = date.getHours() * 60 + date.getMinutes();
  return total >= 2 * 60 + 30 && total < 6 * 60;
}

function deriveResult(s: FlowState): {
  kind: ResultKind;
  title: string;
  reason: string;
  confidence: "low" | "medium" | "high";
} {
  if (s.hydrant || s.driveway) {
    return {
      kind: "no",
      title: "Do not park here",
      reason: "Too close to a fire hydrant or driveway.",
      confidence: "high",
    };
  }
  if (s.sign) {
    return {
      kind: "risky",
      title: "This spot may be restricted",
      reason: "Parking signs may apply (time limits or restrictions).",
      confidence: "medium",
    };
  }
  return {
    kind: "ok",
    title: "You can likely park here",
    reason: "No obvious restrictions detected.",
    confidence: "medium",
  };
}

const resultStyles: Record<
  ResultKind,
  {
    icon: typeof CheckCircle2;
    cardClass: string;
    badgeClass: string;
    titleClass: string;
    iconClass: string;
    label: string;
  }
> = {
  ok: {
    icon: CheckCircle2,
    cardClass: "bg-status-green-bg border-status-green/25",
    badgeClass: "bg-status-green/10 text-status-green border-status-green/20",
    titleClass: "text-status-green",
    iconClass: "text-status-green",
    label: "Likely allowed",
  },
  risky: {
    icon: AlertTriangle,
    cardClass: "bg-status-yellow-bg border-status-yellow/25",
    badgeClass: "bg-status-yellow/10 text-status-yellow border-status-yellow/20",
    titleClass: "text-status-yellow",
    iconClass: "text-status-yellow",
    label: "Caution",
  },
  no: {
    icon: XCircle,
    cardClass: "bg-status-red-bg border-status-red/25",
    badgeClass: "bg-status-red/10 text-status-red border-status-red/20",
    titleClass: "text-status-red",
    iconClass: "text-status-red",
    label: "Do not park",
  },
};

interface StepHeaderProps {
  step: number;
  total: number;
  onBack: () => void;
  title: string;
}

const StepHeader = ({ step, total, onBack, title }: StepHeaderProps) => (
  <div className="flex items-center justify-between">
    <button
      onClick={onBack}
      className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground active:scale-[0.98] transition-transform"
      aria-label="Back"
    >
      <ArrowLeft className="h-4 w-4" />
    </button>
    <p className="text-xs font-medium text-muted-foreground">
      {title} · Step {step} of {total}
    </p>
    <div className="h-10 w-10" />
  </div>
);

const ParkingFlow = ({ onExit }: Props) => {
  const [step, setStep] = useState<Step>("location");
  const [state, setState] = useState<FlowState>({});
  const [loading, setLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Timer
  const [timerStartedAt, setTimerStartedAt] = useState<number | null>(null);
  const [timerEndsAt, setTimerEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [reminders, setReminders] = useState({
    fifteen: true,
    ten: false,
    expiry: true,
  });

  useEffect(() => {
    if (!timerEndsAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [timerEndsAt]);

  const logSession = async (
    overrides: Partial<{
      user_parked: boolean;
      timer_started: boolean;
    }> = {},
    snapshot?: FlowState,
  ) => {
    const s = snapshot ?? state;
    if (!s.resultKind) return;
    await supabase.from("parking_sessions").insert({
      lat: s.lat ?? null,
      lng: s.lng ?? null,
      hydrant: s.hydrant ?? null,
      driveway: s.driveway ?? null,
      sign: s.sign ?? null,
      result: s.resultKind,
      reason: s.resultReason ?? null,
      user_parked: overrides.user_parked ?? false,
      timer_started: overrides.timer_started ?? false,
    });
  };

  const useLocation = () => {
    setLoading(true);
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError("Location not supported by your browser.");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const date = new Date();

        if (inWinterOvernight(date)) {
          const next: FlowState = {
            lat,
            lng,
            resultKind: "no",
            resultTitle: "Do not park here",
            resultReason: "Winter overnight parking restriction (2:30–6:00 AM).",
            confidence: "high",
            isWinterRule: true,
          };
          setState(next);
          setStep("result");
          setLoading(false);
          await logSession({}, next);
          return;
        }

        setState((prev) => ({ ...prev, lat, lng }));
        setStep("q1");
        setLoading(false);
      },
      () => {
        setLocationError("Could not get your location. Please enable GPS.");
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const answer = (key: "hydrant" | "driveway" | "sign", value: boolean) => {
    const updated: FlowState = { ...state, [key]: value };
    setState(updated);

    if (key === "hydrant") setStep("q2");
    else if (key === "driveway") setStep("q3");
    else if (key === "sign") {
      const r = deriveResult(updated);
      const next: FlowState = {
        ...updated,
        resultKind: r.kind,
        resultTitle: r.title,
        resultReason: r.reason,
        confidence: r.confidence,
      };
      setState(next);
      setStep("result");
      void logSession({}, next);
    }
  };

  const goBack = () => {
    if (step === "location") onExit();
    else if (step === "q1") setStep("location");
    else if (step === "q2") setStep("q1");
    else if (step === "q3") setStep("q2");
    else if (step === "result") {
      if (state.isWinterRule) setStep("location");
      else setStep("q3");
    } else if (step === "timer") setStep("result");
  };

  const checkAnotherSpot = () => {
    setState({});
    setTimerStartedAt(null);
    setTimerEndsAt(null);
    setStep("location");
  };

  const handleParkedHere = async () => {
    await logSession({ user_parked: true });
    toast.success("Saved. Drive safe.");
  };

  const startTimer = async () => {
    const startAt = Date.now();
    const endAt = startAt + TWO_HOURS_MS;
    setTimerStartedAt(startAt);
    setTimerEndsAt(endAt);
    setNow(startAt);
    setStep("timer");
    await logSession({ user_parked: true, timer_started: true });
    toast.success("2-hour parking timer started.");
  };

  // ==== Render ====

  if (step === "location") {
    return (
      <div className="space-y-6 animate-fade-in">
        <StepHeader step={1} total={4} onBack={goBack} title="Location" />

        <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-lg font-semibold tracking-tight">
            Where are you parking?
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            We use your location to check Cambridge parking rules for right now.
          </p>
        </div>

        <button
          onClick={useLocation}
          disabled={loading}
          className="flex w-full items-center justify-center gap-3 rounded-3xl bg-primary px-5 py-5 text-lg font-semibold text-primary-foreground shadow-lg transition-transform active:scale-[0.98] disabled:opacity-70"
        >
          {loading ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin" />
              Getting location…
            </>
          ) : (
            <>
              <MapPin className="h-6 w-6" />
              Use my location
            </>
          )}
        </button>

        <button
          disabled
          className="w-full rounded-2xl border border-border bg-card py-4 text-sm font-medium text-muted-foreground opacity-60"
        >
          Enter address (coming soon)
        </button>

        {locationError && (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-center">
            <p className="text-sm text-destructive">{locationError}</p>
          </div>
        )}
      </div>
    );
  }

  if (step === "q1" || step === "q2" || step === "q3") {
    const questions = {
      q1: {
        n: 2,
        title: "Question",
        prompt: "Are you within 3 meters of a fire hydrant?",
        key: "hydrant" as const,
      },
      q2: {
        n: 3,
        title: "Question",
        prompt: "Are you blocking or too close to a driveway?",
        key: "driveway" as const,
      },
      q3: {
        n: 4,
        title: "Question",
        prompt: "Do you see a parking sign nearby?",
        key: "sign" as const,
      },
    };
    const q = questions[step];

    return (
      <div className="space-y-6 animate-fade-in">
        <StepHeader step={q.n} total={4} onBack={goBack} title={q.title} />

        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <p className="text-2xl font-semibold tracking-tight leading-snug">
            {q.prompt}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => answer(q.key, true)}
            className="rounded-3xl bg-primary py-6 text-lg font-semibold text-primary-foreground shadow-lg active:scale-[0.98] transition-transform"
          >
            Yes
          </button>
          <button
            onClick={() => answer(q.key, false)}
            className="rounded-3xl border border-border bg-card py-6 text-lg font-semibold text-card-foreground shadow-sm active:scale-[0.98] transition-transform"
          >
            No
          </button>
        </div>
      </div>
    );
  }

  if (step === "result" && state.resultKind) {
    const c = resultStyles[state.resultKind];
    const Icon = c.icon;

    return (
      <div className="space-y-4 animate-fade-in">
        <StepHeader step={4} total={4} onBack={goBack} title="Result" />

        <div className={`rounded-3xl border p-6 shadow-sm ${c.cardClass}`}>
          <div className="flex flex-col items-center text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-background/70 shadow-sm">
              <Icon className={`h-12 w-12 ${c.iconClass}`} />
            </div>
            <div
              className={`mt-4 inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${c.badgeClass}`}
            >
              {c.label}
            </div>
            <h2
              className={`mt-3 text-2xl font-semibold tracking-tight ${c.titleClass}`}
            >
              {state.resultTitle}
            </h2>
            <p className="mt-2 text-sm leading-6 text-foreground/85">
              {state.resultReason}
            </p>
            <p className="mt-3 text-xs text-muted-foreground capitalize">
              Confidence: {state.confidence}
            </p>
          </div>
        </div>

        {state.lat !== undefined && state.lng !== undefined && (
          <div className="rounded-3xl border border-border bg-card p-3 shadow-sm">
            <LocationMap lat={state.lat} lng={state.lng} />
          </div>
        )}

        {state.resultKind === "risky" && (
          <button
            onClick={() => {
              const input = document.getElementById(
                "sign-photo-input",
              ) as HTMLInputElement | null;
              input?.click();
            }}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border border-border bg-card py-4 font-medium text-card-foreground shadow-sm active:scale-[0.98] transition-transform"
          >
            <Camera className="h-5 w-5" />
            Take photo of sign
            <input
              id="sign-photo-input"
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  toast.success("Photo captured.");
                }
              }}
            />
          </button>
        )}

        {state.resultKind !== "no" && (
          <button
            onClick={startTimer}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-primary py-4 font-semibold text-primary-foreground shadow-lg active:scale-[0.98] transition-transform"
          >
            <Clock3 className="h-5 w-5" />
            Start parking timer
          </button>
        )}

        {state.resultKind !== "no" && (
          <button
            onClick={handleParkedHere}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border border-border bg-card py-4 font-medium text-card-foreground shadow-sm active:scale-[0.98] transition-transform"
          >
            <CarFront className="h-5 w-5" />
            I parked here
          </button>
        )}

        <button
          onClick={checkAnotherSpot}
          className="w-full rounded-2xl border border-border bg-background py-4 font-medium text-muted-foreground active:scale-[0.98] transition-transform"
        >
          Check another spot
        </button>
      </div>
    );
  }

  if (step === "timer" && timerEndsAt) {
    const remaining = Math.max(0, timerEndsAt - now);
    const totalSec = Math.floor(remaining / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const moveBy = new Date(timerEndsAt).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });

    return (
      <div className="space-y-4 animate-fade-in">
        <StepHeader step={4} total={4} onBack={goBack} title="Parked" />

        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-muted">
            <Clock3 className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="mt-4 text-sm font-medium text-muted-foreground">
            Time remaining
          </p>
          <p className="mt-2 text-5xl font-bold tracking-tight tabular-nums">
            {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:
            {String(s).padStart(2, "0")}
          </p>
          <p className="mt-3 text-base font-medium">Move by {moveBy}</p>
        </div>

        <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium">Reminders</p>
          </div>
          <div className="mt-3 space-y-2">
            {(
              [
                { key: "fifteen", label: "15 minutes before" },
                { key: "ten", label: "10 minutes before" },
                { key: "expiry", label: "At expiry" },
              ] as const
            ).map((opt) => (
              <label
                key={opt.key}
                className="flex items-center justify-between rounded-2xl border border-border bg-background px-4 py-3 cursor-pointer"
              >
                <span className="text-sm">{opt.label}</span>
                <input
                  type="checkbox"
                  checked={reminders[opt.key]}
                  onChange={(e) =>
                    setReminders((prev) => ({
                      ...prev,
                      [opt.key]: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 accent-primary"
                />
              </label>
            ))}
          </div>
        </div>

        <button
          onClick={() => {
            setTimerEndsAt(null);
            setTimerStartedAt(null);
            toast.success("Timer cleared.");
            setStep("result");
          }}
          className="w-full rounded-2xl border border-border bg-card py-4 font-medium text-muted-foreground active:scale-[0.98] transition-transform"
        >
          Clear timer
        </button>

        <button
          onClick={checkAnotherSpot}
          className="w-full rounded-2xl border border-border bg-background py-4 font-medium text-muted-foreground active:scale-[0.98] transition-transform"
        >
          Check another spot
        </button>
      </div>
    );
  }

  return null;
};

export default ParkingFlow;
