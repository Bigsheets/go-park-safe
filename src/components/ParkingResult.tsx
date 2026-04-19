import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  MapPin,
  Flag,
  Clock3,
  CarFront,
} from "lucide-react";
import { toast } from "sonner";
import LocationMap from "./LocationMap";
import { supabase } from "@/integrations/supabase/client";

type ParkingStatus = "allowed" | "risky" | "not_allowed";

interface ParkingInfo {
  status: ParkingStatus;
  title: string;
  explanation: string;
  lat?: number;
  lng?: number;
}

interface Props {
  info: ParkingInfo;
  onReset: () => void;
}

type SignType = "no_parking" | "max_3h" | "permit_only" | "unknown";

interface ParkedSession {
  parkedAt: string;
  expiresAt: string;
  lat?: number;
  lng?: number;
  title: string;
}

const PARKED_SESSION_KEY = "active_parked_session";
const THREE_HOURS_MS = 3 * 60 * 60 * 1000;

const config = {
  allowed: {
    icon: CheckCircle2,
    cardClass: "bg-status-green-bg border-status-green/25",
    badgeClass: "bg-status-green/10 text-status-green border-status-green/20",
    titleClass: "text-status-green",
    iconClass: "text-status-green",
    label: "Looks OK",
  },
  risky: {
    icon: AlertTriangle,
    cardClass: "bg-status-yellow-bg border-status-yellow/25",
    badgeClass: "bg-status-yellow/10 text-status-yellow border-status-yellow/20",
    titleClass: "text-status-yellow",
    iconClass: "text-status-yellow",
    label: "Caution",
  },
  not_allowed: {
    icon: XCircle,
    cardClass: "bg-status-red-bg border-status-red/25",
    badgeClass: "bg-status-red/10 text-status-red border-status-red/20",
    titleClass: "text-status-red",
    iconClass: "text-status-red",
    label: "Do Not Park",
  },
};

function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "Time is up";

  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) return `${minutes}m remaining`;
  return `${hours}h ${minutes}m remaining`;
}

const ParkingResult = ({ info, onReset }: Props) => {
  const c = config[info.status];
  const Icon = c.icon;

  const [showLogForm, setShowLogForm] = useState(false);
  const [signType, setSignType] = useState<SignType>("unknown");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const [parkedSession, setParkedSession] = useState<ParkedSession | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const saved = localStorage.getItem(PARKED_SESSION_KEY);
    if (saved) {
      try {
        setParkedSession(JSON.parse(saved));
      } catch {
        localStorage.removeItem(PARKED_SESSION_KEY);
      }
    }
  }, []);

  useEffect(() => {
    if (!parkedSession) return;

    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 30000);

    return () => window.clearInterval(interval);
  }, [parkedSession]);

  const remainingMs = useMemo(() => {
    if (!parkedSession) return 0;
    return new Date(parkedSession.expiresAt).getTime() - now;
  }, [parkedSession, now]);

  const handleReport = () => {
    toast.success("Thanks. Your feedback has been noted.");
  };

  const handleSaveLog = async () => {
    if (info.lat === undefined || info.lng === undefined) {
      toast.error("Missing location for this report.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("parking_reports").insert({
      sign_type: signType,
      notes: notes || null,
      lat: info.lat,
      lng: info.lng,
    });

    setSaving(false);

    if (error) {
      toast.error("Could not save report. Please try again.");
      return;
    }

    toast.success("Posted parking rule added. Thanks for helping improve the app.");
    setShowLogForm(false);
    setSignType("unknown");
    setNotes("");
  };

  const handleParkHere = () => {
    const parkedAt = new Date();
    const expiresAt = new Date(parkedAt.getTime() + THREE_HOURS_MS);

    const session: ParkedSession = {
      parkedAt: parkedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      lat: info.lat,
      lng: info.lng,
      title: info.title,
    };

    localStorage.setItem(PARKED_SESSION_KEY, JSON.stringify(session));
    setParkedSession(session);
    setNow(Date.now());

    toast.success("Parking timer started.");
  };

  const handleClearTimer = () => {
    localStorage.removeItem(PARKED_SESSION_KEY);
    setParkedSession(null);
    toast.success("Parking timer cleared.");
  };

  return (
    <div className="w-full space-y-4 animate-fade-in">
      {/* Result Card */}
      <div className={`rounded-3xl border p-5 shadow-sm ${c.cardClass}`}>
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-background/70 shadow-sm">
            <Icon className={`w-6 h-6 ${c.iconClass}`} />
          </div>

          <div className="flex-1">
            <div
              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${c.badgeClass}`}
            >
              {c.label}
            </div>

            <h2 className={`mt-3 text-2xl font-semibold tracking-tight ${c.titleClass}`}>
              {info.title}
            </h2>

            <p className="mt-2 text-sm leading-6 text-foreground/85">
              {info.explanation}
            </p>

            <p className="mt-3 text-xs text-muted-foreground">
              Guidance based on Cambridge rules and nearby reported restrictions when available.
            </p>
          </div>
        </div>
      </div>

      {/* Map Section */}
      {info.lat !== undefined && info.lng !== undefined && (
        <div className="rounded-3xl border border-border bg-card p-3 shadow-sm">
          <div className="mb-3 flex items-center gap-2 px-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted">
              <MapPin className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Your location</p>
              <p className="text-xs text-muted-foreground">
                Use nearby signs as the final source of truth
              </p>
            </div>
          </div>
          <LocationMap lat={info.lat} lng={info.lng} />
        </div>
      )}

      {/* Parking Timer */}
      {parkedSession ? (
        <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-muted">
              <Clock3 className="h-5 w-5 text-muted-foreground" />
            </div>

            <div className="flex-1">
              <p className="text-sm font-semibold">You parked here</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Parked at {formatTime(parkedSession.parkedAt)}
              </p>
              <p className="text-sm text-muted-foreground">
                Return by {formatTime(parkedSession.expiresAt)}
              </p>
              <p className="mt-3 text-base font-semibold">
                {formatRemaining(remainingMs)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Based on general 3-hour parking guidance.
              </p>
            </div>
          </div>

          <button
            onClick={handleClearTimer}
            className="mt-4 w-full rounded-2xl border border-border bg-background py-3.5 font-medium text-muted-foreground transition-transform active:scale-[0.98]"
          >
            Clear Timer
          </button>
        </div>
      ) : (
        info.status !== "not_allowed" && (
          <button
            onClick={handleParkHere}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-primary py-4 text-base font-semibold text-primary-foreground shadow-lg transition-transform active:scale-[0.98]"
          >
            <CarFront className="h-5 w-5" />
            I Parked Here
          </button>
        )
      )}

      {/* Primary Action */}
      <button
        onClick={onReset}
        className="w-full py-4 rounded-2xl border border-border bg-card text-card-foreground text-base font-medium shadow-sm active:scale-[0.98] transition-transform"
      >
        Check Another Spot
      </button>

      {/* Secondary Actions */}
      <div className="space-y-3">
        <button
          onClick={() => setShowLogForm((prev) => !prev)}
          className="w-full py-4 rounded-2xl border border-border bg-card text-card-foreground font-medium shadow-sm active:scale-[0.98] transition-transform"
        >
          {showLogForm ? "Close Form" : "Add Posted Parking Rule"}
        </button>

        {showLogForm && (
          <div className="rounded-3xl border border-border bg-card p-4 space-y-4 shadow-sm">
            <div className="flex items-start gap-3 rounded-2xl bg-muted/60 p-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-background">
                <Flag className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                Only report posted parking signs or marked parking restrictions. Do not
                log fire hydrants, driveways, or temporary obstacles.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Sign type</label>
              <select
                value={signType}
                onChange={(e) => setSignType(e.target.value as SignType)}
                className="w-full rounded-2xl border border-input bg-background px-3 py-3 text-sm shadow-sm"
              >
                <option value="unknown">Other posted restriction</option>
                <option value="no_parking">No parking sign</option>
                <option value="max_3h">3-hour parking sign</option>
                <option value="permit_only">Permit parking sign</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Example: No parking Mon–Fri 8 AM to 6 PM."
                className="w-full rounded-2xl border border-input bg-background px-3 py-3 text-sm min-h-[110px] resize-none shadow-sm"
              />
            </div>

            <button
              onClick={handleSaveLog}
              disabled={saving}
              className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-semibold shadow-sm active:scale-[0.98] transition-transform disabled:opacity-70"
            >
              {saving ? "Saving…" : "Save Posted Rule"}
            </button>
          </div>
        )}

        <button
          onClick={handleReport}
          className="w-full py-4 rounded-2xl border border-border bg-background font-medium text-muted-foreground active:scale-[0.98] transition-transform"
        >
          Report Incorrect Result
        </button>
      </div>
    </div>
  );
};

export default ParkingResult;
