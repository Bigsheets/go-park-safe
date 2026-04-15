import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { toast } from "sonner";

type ParkingStatus = "allowed" | "risky" | "not_allowed";

interface ParkingInfo {
  status: ParkingStatus;
  title: string;
  explanation: string;
}

const config: Record<ParkingStatus, { icon: typeof CheckCircle2; bg: string; border: string; text: string; iconColor: string }> = {
  allowed: { icon: CheckCircle2, bg: "bg-status-green-bg", border: "border-status-green/30", text: "text-status-green", iconColor: "text-status-green" },
  risky: { icon: AlertTriangle, bg: "bg-status-yellow-bg", border: "border-status-yellow/30", text: "text-status-yellow", iconColor: "text-status-yellow" },
  not_allowed: { icon: XCircle, bg: "bg-status-red-bg", border: "border-status-red/30", text: "text-status-red", iconColor: "text-status-red" },
};

interface Props {
  info: ParkingInfo;
  onReset: () => void;
}

const ParkingResult = ({ info, onReset }: Props) => {
  const c = config[info.status];
  const Icon = c.icon;

  const handleReport = () => {
    toast.success("Thanks! Your report has been noted.");
  };

  return (
    <div className="w-full space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className={`${c.bg} border ${c.border} rounded-2xl p-6 text-center space-y-3`}>
        <Icon className={`w-14 h-14 mx-auto ${c.iconColor}`} />
        <h2 className={`text-2xl font-bold ${c.text}`}>{info.title}</h2>
        <p className="text-foreground/80 text-base leading-relaxed">{info.explanation}</p>
      </div>

      <button
        onClick={onReset}
        className="w-full py-4 rounded-2xl bg-primary text-primary-foreground text-lg font-semibold active:scale-[0.97] transition-transform"
      >
        Check Again
      </button>

      <button
        onClick={handleReport}
        className="block mx-auto text-sm text-muted-foreground underline underline-offset-2"
      >
        Report incorrect result
      </button>
    </div>
  );
};

export default ParkingResult;
