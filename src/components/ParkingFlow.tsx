import { useEffect, useRef, useState } from "react";
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
  Flame,
  DoorOpen,
  Signpost,
  ThumbsUp,
  ThumbsDown,
  Image as ImageIcon,
  Send,
  Loader,
} from "lucide-react";
import { toast } from "sonner";
import LocationMap from "./LocationMap";
import { supabase } from "@/integrations/supabase/client";

type Step = "location" | "q1" | "q2" | "q3" | "result" | "log" | "timer";
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
  const inSeason = month === 0 || month === 1 || (month === 2 && day <= 15);
  if (!inSeason) return false;
  const total = date.getHours() * 60 + date.getMinutes();
  return total >= 2 * 60 + 30 && total < 6 * 60;
}

function deriveResult(s: FlowState) {
  if (s.hydrant || s.driveway) {
    return {
      kind: "no" as const,
      title: "Do not park here",
      reason: "Too close to a fire hydrant or driveway.",
      confidence: "high" as const,
    };
  }
  if (s.sign) {
    return {
      kind: "risky" as const,
      title: "This spot may be restricted",
      reason: "Parking signs may apply (time limits or restrictions).",
      confidence: "medium" as const,
    };
  }
  return {
    kind: "ok" as const,
    title: "You can likely park here",
    reason: "No obvious restrictions detected.",
    confidence: "medium" as const,
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
    ringClass: string;
    iconRingClass: string;
  }
> = {
  ok: {
    icon: CheckCircle2,
    cardClass:
      "bg-status-green-bg border-status-green/50 [background-image:var(--gradient-green)]",
    badgeClass: "bg-status-green/20 text-status-green border-status-green/40",
    titleClass: "text-status-green",
    iconClass: "text-status-green",
    label: "Likely allowed",
    ringClass: "stroke-status-green",
    iconRingClass: "ring-status-green/25 shadow-status-green/30",
  },
  risky: {
    icon: AlertTriangle,
    cardClass:
      "bg-status-yellow-bg border-status-yellow/50 [background-image:var(--gradient-yellow)]",
    badgeClass:
      "bg-status-yellow/20 text-status-yellow border-status-yellow/40",
    titleClass: "text-status-yellow",
    iconClass: "text-status-yellow",
    label: "Caution",
    ringClass: "stroke-status-yellow",
    iconRingClass: "ring-status-yellow/25 shadow-status-yellow/30",
  },
  no: {
    icon: XCircle,
    cardClass:
      "bg-status-red-bg border-status-red/50 [background-image:var(--gradient-red)]",
    badgeClass: "bg-status-red/20 text-status-red border-status-red/40",
    titleClass: "text-status-red",
    iconClass: "text-status-red",
    label: "Do not park",
    ringClass: "stroke-status-red",
    iconRingClass: "ring-status-red/25 shadow-status-red/30",
  },
};

interface StepHeaderProps {
  step: number;
  total: number;
  onBack: () => void;
  title: string;
}

const StepHeader = ({ step, total, onBack, title }: StepHeaderProps) => {
  const pct = Math.round((step / total) * 100);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground active:scale-[0.95] transition-transform"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <p className="text-xs font-medium text-muted-foreground">
          {title} · Step {step} of {total}
        </p>
        <div className="h-10 w-10" />
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-status-blue transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

const ParkingFlow = ({ onExit }: Props) => {
  const [step, setStep] = useState<Step>("location");
  const [state, setState] = useState<FlowState>({});
  const [loading, setLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [tapped, setTapped] = useState<"yes" | "no" | null>(null);

  // Logging
  const [logNote, setLogNote] = useState("");
  const [logFile, setLogFile] = useState<File | null>(null);
  const [logPreview, setLogPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Timer
  const [timerStartedAt, setTimerStartedAt] = useState<number | null>(null);
  const [timerEndsAt, setTimerEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">(
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "unsupported",
  );
  const reminderTimeouts = useRef<number[]>([]);

  useEffect(() => {
    if (!timerEndsAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [timerEndsAt]);

  const clearReminders = () => {
    reminderTimeouts.current.forEach((id) => window.clearTimeout(id));
    reminderTimeouts.current = [];
  };

  useEffect(() => {
    return () => clearReminders();
  }, []);

  const showNotification = (body: string) => {
    try {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Go Park Safe", { body, icon: "/favicon.ico" });
      }
    } catch (e) {
      console.warn("Notification failed", e);
    }
  };

  const scheduleReminders = (endAt: number) => {
    clearReminders();
    const schedule = (msFromNow: number, body: string) => {
      if (msFromNow <= 0) return;
      const id = window.setTimeout(() => showNotification(body), msFromNow);
      reminderTimeouts.current.push(id);
    };
    const remaining = endAt - Date.now();
    schedule(
      remaining - 15 * 60 * 1000,
      "Parking reminder: 15 minutes left before your parking time expires.",
    );
    schedule(
      remaining - 5 * 60 * 1000,
      "Parking reminder: 5 minutes left. Time to move soon.",
    );
    schedule(remaining, "Parking time expired. Move your vehicle now.");
  };

  const requestNotifPermission = async () => {
    if (!("Notification" in window)) {
      setNotifPermission("unsupported");
      return "unsupported" as const;
    }
    if (Notification.permission === "default") {
      const p = await Notification.requestPermission();
      setNotifPermission(p);
      return p;
    }
    setNotifPermission(Notification.permission);
    return Notification.permission;
  };

  const logSession = async (
    overrides: Partial<{ user_parked: boolean; timer_started: boolean }> = {},
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
    setTapped(value ? "yes" : "no");
    const updated: FlowState = { ...state, [key]: value };

    window.setTimeout(() => {
      setState(updated);
      setTapped(null);

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
    }, 280);
  };

  const goBack = () => {
    if (step === "location") onExit();
    else if (step === "q1") setStep("location");
    else if (step === "q2") setStep("q1");
    else if (step === "q3") setStep("q2");
    else if (step === "result") {
      if (state.isWinterRule) setStep("location");
      else setStep("q3");
    } else if (step === "log") setStep("result");
    else if (step === "timer") setStep("result");
  };

  const checkAnotherSpot = () => {
    setState({});
    setTimerStartedAt(null);
    setTimerEndsAt(null);
    setLogNote("");
    setLogFile(null);
    setLogPreview(null);
    setStep("location");
  };

  const startTimer = async () => {
    const startAt = Date.now();
    const endAt = startAt + TWO_HOURS_MS;
    setTimerStartedAt(startAt);
    setTimerEndsAt(endAt);
    setNow(startAt);
    setStep("timer");
    if (remindersEnabled) {
      const p = await requestNotifPermission();
      if (p === "granted") {
        scheduleReminders(endAt);
        toast.success("Timer started · reminders enabled.");
      } else {
        toast.success("Timer started. Notifications not enabled.");
      }
    } else {
      toast.success("2-hour parking timer started.");
    }
    await logSession({ user_parked: true, timer_started: true });
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setLogFile(f);
    const url = URL.createObjectURL(f);
    setLogPreview(url);
  };

  const submitLog = async () => {
    if (!state.resultKind) return;
    setSubmitting(true);
    try {
      let photo_url: string | null = null;
      if (logFile) {
        const ext = logFile.name.split(".").pop() || "jpg";
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("parking-photos")
          .upload(path, logFile, { contentType: logFile.type });
        if (upErr) throw upErr;
        const { data } = supabase.storage
          .from("parking-photos")
          .getPublicUrl(path);
        photo_url = data.publicUrl;
      }

      const { error } = await supabase.from("parking_logs").insert({
        lat: state.lat ?? null,
        lng: state.lng ?? null,
        result: state.resultKind,
        hydrant: state.hydrant ?? null,
        driveway: state.driveway ?? null,
        sign: state.sign ?? null,
        note: logNote.trim() || null,
        photo_url,
      });
      if (error) throw error;

      await logSession({ user_parked: true });
      toast.success("Spot logged. Thanks!");
      setLogFile(null);
      setLogPreview(null);
      setLogNote("");
      setStep("result");
    } catch (err) {
      console.error(err);
      toast.error("Could not save the log. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ==== Render ====

  if (step === "location") {
    return (
      <div className="space-y-6 animate-fade-in">
        <StepHeader step={1} total={4} onBack={goBack} title="Location" />

        <div className="rounded-3xl border border-status-blue/20 bg-status-blue-bg p-5 shadow-sm [background-image:var(--gradient-blue)]">
          <h2 className="text-lg font-semibold tracking-tight">
            Where are you parking?
          </h2>
          <p className="mt-1 text-sm leading-6 text-foreground/80">
            We use your location to check Cambridge parking rules for right now.
          </p>
        </div>

        <button
          onClick={useLocation}
          disabled={loading}
          className="flex w-full items-center justify-center gap-3 rounded-3xl bg-status-blue px-5 py-5 text-lg font-semibold text-white shadow-lg shadow-status-blue/20 transition-transform active:scale-[0.97] disabled:opacity-70"
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
        index: 1,
        title: "Question",
        prompt: "Are you within 3 meters of a fire hydrant?",
        key: "hydrant" as const,
        Icon: Flame,
        accent: "text-status-red",
        accentBg: "bg-status-red-bg",
      },
      q2: {
        n: 3,
        index: 2,
        title: "Question",
        prompt: "Are you blocking or too close to a driveway?",
        key: "driveway" as const,
        Icon: DoorOpen,
        accent: "text-status-yellow",
        accentBg: "bg-status-yellow-bg",
      },
      q3: {
        n: 4,
        index: 3,
        title: "Question",
        prompt: "Do you see a parking sign nearby?",
        key: "sign" as const,
        Icon: Signpost,
        accent: "text-status-blue",
        accentBg: "bg-status-blue-bg",
      },
    };
    const q = questions[step];
    const Icon = q.Icon;

    return (
      <div className="space-y-6 animate-slide-in-right" key={step}>
        <StepHeader step={q.n} total={4} onBack={goBack} title={q.title} />

        <p className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Question {q.index} of 3
        </p>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <div
            className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${q.accentBg}`}
          >
            <Icon className={`h-7 w-7 ${q.accent}`} />
          </div>
          <p className="text-center text-2xl font-semibold tracking-tight leading-snug">
            {q.prompt}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => answer(q.key, true)}
            disabled={tapped !== null}
            className={`flex flex-col items-center justify-center gap-2 rounded-3xl bg-status-red py-7 text-lg font-semibold text-white shadow-lg shadow-status-red/20 transition-all disabled:opacity-90 ${
              tapped === "yes" ? "animate-tap-bounce ring-4 ring-status-red/40" : "active:scale-[0.97]"
            }`}
          >
            <ThumbsUp className="h-6 w-6" />
            Yes
          </button>
          <button
            onClick={() => answer(q.key, false)}
            disabled={tapped !== null}
            className={`flex flex-col items-center justify-center gap-2 rounded-3xl bg-status-green py-7 text-lg font-semibold text-white shadow-lg shadow-status-green/20 transition-all disabled:opacity-90 ${
              tapped === "no" ? "animate-tap-bounce ring-4 ring-status-green/40" : "active:scale-[0.97]"
            }`}
          >
            <ThumbsDown className="h-6 w-6" />
            No
          </button>
        </div>
      </div>
    );
  }

  if (step === "result" && state.resultKind) {
    const c = resultStyles[state.resultKind];
    const Icon = c.icon;
    const isNo = state.resultKind === "no";

    const confidenceLabel =
      state.confidence === "high"
        ? "High confidence"
        : state.confidence === "low"
          ? "Low confidence"
          : "Medium confidence";

    return (
      <div className="space-y-5 animate-fade-in">
        <StepHeader step={4} total={4} onBack={goBack} title="Result" />

        {/* Dominant result card */}
        <div
          className={`relative overflow-hidden rounded-[2rem] border-2 p-8 shadow-xl ${c.cardClass}`}
        >
          <div className="flex flex-col items-center text-center">
            <div
              className={`flex h-32 w-32 items-center justify-center rounded-full bg-background/95 ring-8 shadow-2xl ${c.iconRingClass}`}
            >
              <Icon className={`h-20 w-20 ${c.iconClass}`} strokeWidth={2.5} />
            </div>

            <h2
              className={`mt-7 text-3xl font-bold tracking-tight leading-tight ${c.titleClass}`}
            >
              {state.resultTitle}
            </h2>

            <p className="mt-3 max-w-xs text-base leading-6 text-foreground/85">
              {state.resultReason}
            </p>

            <p className="mt-2 text-xs text-muted-foreground">
              Based on your answers
            </p>

            <div
              className={`mt-5 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${c.badgeClass}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${c.iconClass} bg-current`} />
              {confidenceLabel}
            </div>
          </div>
        </div>

        {state.lat !== undefined && state.lng !== undefined && (
          <div className="rounded-2xl border border-border/50 bg-card/60 p-2 opacity-90">
            <LocationMap lat={state.lat} lng={state.lng} />
          </div>
        )}

        {/* Secondary actions */}
        <div className="space-y-2 pt-4">
          {!isNo && (
            <button
              onClick={startTimer}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-status-blue/30 bg-status-blue/10 py-3 text-sm font-medium text-status-blue active:scale-[0.97] transition-transform"
            >
              <Clock3 className="h-4 w-4" />
              Start parking timer
            </button>
          )}

          <button
            onClick={() => setStep("log")}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3 text-sm font-medium text-card-foreground active:scale-[0.97] transition-transform"
          >
            {isNo ? (
              <>
                <AlertTriangle className="h-4 w-4 text-status-red" />
                Report confusing sign or location
              </>
            ) : (
              <>
                <Camera className="h-4 w-4 text-status-blue" />
                {state.resultKind === "ok" ? "I parked here · Add photo" : "Add photo of sign"}
              </>
            )}
          </button>

          <button
            onClick={checkAnotherSpot}
            className="w-full rounded-2xl py-3 text-sm font-medium text-muted-foreground hover:text-foreground active:scale-[0.97] transition-all"
          >
            Check another spot
          </button>
        </div>
      </div>
    );
  }

  if (step === "log" && state.resultKind) {
    const isNo = state.resultKind === "no";
    return (
      <div className="space-y-4 animate-fade-in">
        <StepHeader step={4} total={4} onBack={goBack} title="Log spot" />

        <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-lg font-semibold tracking-tight">
            {isNo ? "Report this spot" : "Log this spot"}
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Optional photo and note. This helps build local awareness — it does
            not change parking decisions.
          </p>
        </div>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card py-5 font-medium text-card-foreground active:scale-[0.97] transition-transform"
        >
          {logPreview ? (
            <div className="flex w-full items-center gap-3 px-2">
              <img
                src={logPreview}
                alt="Selected sign"
                className="h-16 w-16 rounded-xl object-cover"
              />
              <div className="flex-1 text-left">
                <p className="text-sm font-medium">Photo attached</p>
                <p className="text-xs text-muted-foreground">Tap to change</p>
              </div>
              <ImageIcon className="h-5 w-5 text-muted-foreground" />
            </div>
          ) : (
            <>
              <Camera className="h-5 w-5 text-status-blue" />
              Take or upload a photo
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onPickFile}
          />
        </button>

        <textarea
          value={logNote}
          onChange={(e) => setLogNote(e.target.value)}
          placeholder={
            isNo
              ? "What's confusing? (e.g. sign covered by tree)"
              : "Optional note (e.g. 2-hour limit posted)"
          }
          rows={4}
          className="w-full resize-none rounded-2xl border border-border bg-card px-4 py-3 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-status-blue/30"
        />

        <button
          onClick={submitLog}
          disabled={submitting}
          className="flex w-full items-center justify-center gap-3 rounded-2xl bg-status-blue py-4 font-semibold text-white shadow-lg shadow-status-blue/20 active:scale-[0.97] transition-transform disabled:opacity-70"
        >
          {submitting ? (
            <>
              <Loader className="h-5 w-5 animate-spin" />
              Submitting…
            </>
          ) : (
            <>
              <Send className="h-5 w-5" />
              Submit log
            </>
          )}
        </button>

        {!isNo && (
          <button
            onClick={async () => {
              setSubmitting(true);
              try {
                await logSession({ user_parked: true });
                await supabase.from("parking_logs").insert({
                  lat: state.lat ?? null,
                  lng: state.lng ?? null,
                  result: state.resultKind!,
                  hydrant: state.hydrant ?? null,
                  driveway: state.driveway ?? null,
                  sign: state.sign ?? null,
                  note: null,
                  photo_url: null,
                });
                toast.success("Saved. Drive safe.");
                setStep("result");
              } catch {
                toast.error("Could not save.");
              } finally {
                setSubmitting(false);
              }
            }}
            disabled={submitting}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border border-border bg-card py-4 font-medium text-card-foreground shadow-sm active:scale-[0.97] transition-transform disabled:opacity-70"
          >
            <CarFront className="h-5 w-5" />
            I parked here (skip photo)
          </button>
        )}
      </div>
    );
  }

  if (step === "timer" && timerEndsAt && timerStartedAt) {
    const remaining = Math.max(0, timerEndsAt - now);
    const totalSec = Math.floor(remaining / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const moveBy = new Date(timerEndsAt).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
    const elapsed = now - timerStartedAt;
    const progress = Math.min(1, elapsed / TWO_HOURS_MS);
    const radius = 78;
    const circ = 2 * Math.PI * radius;
    const dashOffset = circ * progress;
    const lowTime = remaining < 15 * 60 * 1000;
    const ringColor = lowTime ? "stroke-status-yellow" : "stroke-status-blue";

    return (
      <div className="space-y-4 animate-fade-in">
        <StepHeader step={4} total={4} onBack={goBack} title="Parked" />

        <div className="rounded-3xl border border-status-blue/20 bg-status-blue-bg p-6 shadow-sm text-center [background-image:var(--gradient-blue)]">
          <div className="relative mx-auto h-48 w-48">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 180 180">
              <circle
                cx="90"
                cy="90"
                r={radius}
                strokeWidth="10"
                className="fill-none stroke-background/60"
              />
              <circle
                cx="90"
                cy="90"
                r={radius}
                strokeWidth="10"
                strokeLinecap="round"
                className={`fill-none ${ringColor} transition-all duration-700 ease-out`}
                style={{
                  strokeDasharray: circ,
                  strokeDashoffset: dashOffset,
                }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Time left
              </p>
              <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums">
                {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:
                {String(s).padStart(2, "0")}
              </p>
            </div>
          </div>
          <p className="mt-4 text-base font-semibold">Move by {moveBy}</p>
        </div>

        <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-status-blue" />
              <p className="text-sm font-medium">
                {notifPermission === "granted" && reminderTimeouts.current.length > 0
                  ? "Reminders enabled"
                  : "Notifications not enabled"}
              </p>
            </div>
            {notifPermission !== "granted" && notifPermission !== "unsupported" && (
              <button
                onClick={async () => {
                  const p = await requestNotifPermission();
                  if (p === "granted" && timerEndsAt) {
                    scheduleReminders(timerEndsAt);
                    toast.success("Reminders enabled.");
                  } else if (p === "denied") {
                    toast.error("Notifications blocked in your browser.");
                  }
                }}
                className="rounded-full bg-status-blue px-3 py-1 text-xs font-semibold text-white active:scale-[0.97] transition-transform"
              >
                Enable
              </button>
            )}
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {notifPermission === "granted" && reminderTimeouts.current.length > 0
              ? "We'll remind you 15 min before, 5 min before, and at expiry."
              : "Notifications are not enabled. Keep this screen open to track your timer."}
          </p>
        </div>

        <button
          onClick={() => {
            setTimerEndsAt(null);
            setTimerStartedAt(null);
            toast.success("Timer cleared.");
            setStep("result");
          }}
          className="w-full rounded-2xl border border-border bg-card py-4 font-medium text-muted-foreground active:scale-[0.97] transition-transform"
        >
          Clear timer
        </button>

        <button
          onClick={checkAnotherSpot}
          className="w-full rounded-2xl border border-border bg-background py-4 font-medium text-muted-foreground active:scale-[0.97] transition-transform"
        >
          Check another spot
        </button>
      </div>
    );
  }

  return null;
};

export default ParkingFlow;
