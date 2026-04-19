import { useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
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
    bg: "bg-status-green-bg",
    border: "border-status-green/30",
    text: "text-status-green",
    iconColor: "text-status-green",
  },
  risky: {
    icon: AlertTriangle,
    bg: "bg-status-yellow-bg",
    border: "border-status-yellow/30",
    text: "text-status-yellow",
    iconColor: "text-status-yellow",
  },
  not_allowed: {
    icon: XCircle,
    bg: "bg-status-red-bg",
    border: "border-status-red/30",
    text: "text-status-red",
    iconColor: "text-status-red",
  },
};

const ParkingResult = ({ info, onReset }: Props) => {
  const c = config[info.status];
  const Icon = c.icon;

  const [showLogForm, setShowLogForm] = useState(false);
  const [signType, setSignType] = useState<SignType>("unknown");
  const [notes, setNotes] = useState("");

  const handleReport = () => {
    toast.success("Thanks! Your report has been noted.");
  };

  const handleSaveLog = async () => {
    if (info.lat === undefined || info.lng === undefined) {
      toast.error("Missing location for this report.");
      return;
    }

    const { error } = await supabase.from("parking_reports").insert({
      sign_type: signType,
      notes: notes || null,
      lat: info.lat,
      lng: info.lng,
    });

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
      <div className={`rounded-3xl border p-5 shadow-sm ${c.bg} ${c.border}`}>
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            <Icon className={`w-7 h-7 ${c.iconColor}`} />
          </div>
          <div className="flex-1">
            <h2 className={`text-xl font-semibold ${c.text}`}>{info.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-foreground/90">
              {info.explanation}
            </p>
          </div>
        </div>
      </div>

      {/* Map */}
      {info.lat !== undefined && info.lng !== undefined && (
        <LocationMap lat={info.lat} lng={info.lng} />
      )}

      {/* Actions */}
      <div className="grid grid-cols-1 gap-3">
        {/* Log Button */}
        <button
          onClick={() => setShowLogForm((prev) => !prev)}
          className="w-full py-4 rounded-2xl border border-border bg-card text-card-foreground font-medium shadow-sm active:scale-[0.98] transition-transform"
        >
          {showLogForm ? "Close Form" : "Add Posted Parking Rule"}
        </button>

        {/* Log Form */}
        {showLogForm && (
          <div className="rounded-2xl border border-border bg-card p-4 space-y-4 shadow-sm">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Only report posted parking signs or marked parking restrictions.
              Do not log fire hydrants, driveways, or temporary obstacles.
            </p>

            <div>
              <label className="block text-sm font-medium mb-2">Sign type</label>
              <select
                value={signType}
                onChange={(e) => setSignType(e.target.value as SignType)}
                className="w-full rounded-xl border border-input bg-background px-3 py-3 text-sm"
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
                className="w-full rounded-xl border border-input bg-background px-3 py-3 text-sm min-h-[96px] resize-none"
              />
            </div>

            <button
              onClick={handleSaveLog}
              className="w-full py-3 rounded-2xl bg-primary text-primary-foreground font-semibold shadow-sm active:scale-[0.98] transition-transform"
            >
              Save Posted Rule
            </button>
          </div>
        )}

        {/* Reset */}
        <button
          onClick={onReset}
          className="w-full py-4 rounded-2xl border border-border bg-background font-medium active:scale-[0.98] transition-transform"
        >
          Check Again
        </button>

        {/* Report */}
        <button
          onClick={handleReport}
          className="w-full py-4 rounded-2xl border border-border bg-background font-medium active:scale-[0.98] transition-transform"
        >
          Report Incorrect Result
        </button>
      </div>
    </div>
  );
};

export default ParkingResult;
