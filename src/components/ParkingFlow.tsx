import { inWinterOvernight, deriveResult } from "@/lib/parkingRules";
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

export interface FlowState {
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
    cardClass: "bg-status-green-bg border-status-green/50",
    badgeClass: "bg-status-green/20 text-status-green border-status-green/40",
    titleClass: "text-status-green",
    iconClass: "text-status-green",
    label: "Likely allowed",
  },
  risky: {
    icon: AlertTriangle,
    cardClass: "bg-status-yellow-bg border-status-yellow/50",
    badgeClass: "bg-status-yellow/20 text-status-yellow border-status-yellow/40",
    titleClass: "text-status-yellow",
    iconClass: "text-status-yellow",
    label: "Caution",
  },
  no: {
    icon: XCircle,
    cardClass: "bg-status-red-bg border-status-red/50",
    badgeClass: "bg-status-red/20 text-status-red border-status-red/40",
    titleClass: "text-status-red",
    iconClass: "text-status-red",
    label: "Do not park",
  },
};

const ParkingFlow = ({ onExit }: Props) => {
  const [step, setStep] = useState<Step>("location");
  const [state, setState] = useState<FlowState>({});
  const [loading, setLoading] = useState(false);

  const useLocation = () => {
    setLoading(true);

    navigator.geolocation.getCurrentPosition((pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const date = new Date();

      if (inWinterOvernight(date)) {
        setState({
          lat,
          lng,
          resultKind: "no",
          resultTitle: "Do not park here",
          resultReason:
            "Winter overnight parking restriction (2:30–6:00 AM).",
          confidence: "high",
          isWinterRule: true,
        });
        setStep("result");
        setLoading(false);
        return;
      }

      setState({ lat, lng });
      setStep("q1");
      setLoading(false);
    });
  };

  const answer = (key: "hydrant" | "driveway" | "sign", value: boolean) => {
    const updated = { ...state, [key]: value };

    if (key === "sign") {
      const r = deriveResult(updated);

      setState({
        ...updated,
        resultKind: r.kind,
        resultTitle: r.title,
        resultReason: r.reason,
        confidence: r.confidence,
      });

      setStep("result");
    } else {
      setState(updated);
      setStep(key === "hydrant" ? "q2" : "q3");
    }
  };

  if (step === "location") {
    return (
      <div>
        <button onClick={useLocation}>
          {loading ? "Loading..." : "Use my location"}
        </button>
      </div>
    );
  }

  if (step === "q1") {
    return (
      <div>
        <p>Near hydrant?</p>
        <button onClick={() => answer("hydrant", true)}>Yes</button>
        <button onClick={() => answer("hydrant", false)}>No</button>
      </div>
    );
  }

  if (step === "q2") {
    return (
      <div>
        <p>Blocking driveway?</p>
        <button onClick={() => answer("driveway", true)}>Yes</button>
        <button onClick={() => answer("driveway", false)}>No</button>
      </div>
    );
  }

  if (step === "q3") {
    return (
      <div>
        <p>See a sign?</p>
        <button onClick={() => answer("sign", true)}>Yes</button>
        <button onClick={() => answer("sign", false)}>No</button>
      </div>
    );
  }

  if (step === "result" && state.resultKind) {
    const c = resultStyles[state.resultKind];
    const Icon = c.icon;

    return (
      <div className={`p-6 border ${c.cardClass}`}>
        <Icon className={c.iconClass} />
        <h2 className={c.titleClass}>{state.resultTitle}</h2>
        <p>{state.resultReason}</p>

        <button onClick={() => setStep("location")}>
          Check another spot
        </button>
      </div>
    );
  }

  return null;
};

export default ParkingFlow;
