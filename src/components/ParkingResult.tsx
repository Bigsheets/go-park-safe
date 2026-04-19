import { useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, MapPin, Flag } from "lucide-react";
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

const ParkingResult = ({ info, onReset }: Props) => {
  const c = config[info.status];
  const Icon = c.icon;

  const [showLogForm, setShowLogForm] = useState(false);
  const [signType, setSignType] = useState<SignType>("unknown");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

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

      {/* Primary Action */}
      <button
        onClick={onReset}
        className="w-full py-4 rounded-2xl bg-primary text-primary-foreground text-base font-semibold shadow-lg active:scale-[0.98] transition-transform"
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
