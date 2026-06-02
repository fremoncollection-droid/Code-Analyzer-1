import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useBranding } from "@/lib/branding";
import { useLogin, usePinLogin } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Store, Eye, EyeOff, Loader2, Lock, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const { login } = useAuth();
  const { branding } = useBranding();
  const { toast } = useToast();
  const [mode, setMode] = useState<"password" | "pin">("password");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [remaining, setRemaining] = useState<number | undefined>(undefined);
  const [lockedUntil, setLockedUntil] = useState<number>(0);

  const passwordMutation = useLogin({
    mutation: {
      onSuccess: (data) => {
        login(data.token, data.refreshToken, data.user as any);
      },
      onError: () => {
        toast({ title: "Login failed", description: "Invalid username or password", variant: "destructive" });
      },
    },
  });

  const pinMutation = usePinLogin({
    mutation: {
      onSuccess: (data) => {
        setPinError("");
        setRemaining(undefined);
        login(data.token, data.refreshToken, data.user as any);
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.error || "Invalid PIN";
        const rem = err?.response?.data?.remainingAttempts;
        setPinError(msg);
        if (rem !== undefined) setRemaining(rem);
        if (msg.includes("locked")) {
          const match = msg.match(/(\d+)/);
          if (match) setLockedUntil(Date.now() + parseInt(match[1]) * 60000);
        }
      },
    },
  });

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    passwordMutation.mutate({ data: { username, password } });
  };

  function appendPinDigit(d: string) {
    if (pin.length < 6) {
      setPin(prev => prev + d);
      setPinError("");
    }
  }

  function backspacePin() {
    setPin(prev => prev.slice(0, -1));
    setPinError("");
  }

  function submitPin() {
    if (pin.length < 4) {
      setPinError("PIN must be 4-6 digits");
      return;
    }
    if (!username) {
      setPinError("Enter username first");
      return;
    }
    pinMutation.mutate({ data: { username, pin } });
  }

  const isLocked = lockedUntil > Date.now();
  const lockedMins = isLocked ? Math.ceil((lockedUntil - Date.now()) / 60000) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-teal-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-teal-500 flex items-center justify-center mb-4 shadow-lg shadow-teal-500/30 overflow-hidden">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <Store className="w-8 h-8 text-white" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-white">{branding.isLoading ? "Loading..." : branding.appName}</h1>
          <p className="text-slate-400 text-sm mt-1">Sign in to continue</p>
        </div>

        {/* Username is always required first */}
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Username</Label>
              <Input
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter username"
                className="bg-white/10 border-white/20 text-white placeholder:text-slate-500 focus:border-teal-400"
                autoComplete="username"
                autoFocus
              />
            </div>

            {mode === "password" ? (
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-sm">Password</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Enter password"
                      className="bg-white/10 border-white/20 text-white placeholder:text-slate-500 focus:border-teal-400 pr-10"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full bg-teal-500 hover:bg-teal-400 text-white font-semibold"
                  disabled={passwordMutation.isPending}
                >
                  {passwordMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Signing in...</> : "Sign In"}
                </Button>
                <button
                  type="button"
                  onClick={() => setMode("pin")}
                  className="w-full text-center text-sm text-teal-400 hover:text-teal-300 flex items-center justify-center gap-1"
                >
                  <Lock className="w-3 h-3" /> Use PIN instead
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                {/* PIN display */}
                <div className="flex justify-center gap-2 py-2">
                  {[0, 1, 2, 3, 4, 5].map(i => (
                    <div
                      key={i}
                      className={`w-3 h-3 rounded-full transition-colors ${i < pin.length ? "bg-teal-400" : "bg-white/20"}`}
                    />
                  ))}
                </div>
                {pinError && (
                  <p className="text-red-400 text-xs text-center">{pinError}</p>
                )}
                {remaining !== undefined && !isLocked && (
                  <p className="text-amber-400 text-xs text-center">{remaining} attempt(s) remaining</p>
                )}
                {isLocked && (
                  <p className="text-red-400 text-xs text-center">Locked for {lockedMins} minute(s)</p>
                )}

                {/* Numeric keypad */}
                <div className="grid grid-cols-3 gap-2">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => appendPinDigit(d)}
                      disabled={isLocked}
                      className="h-14 rounded-lg bg-white/10 text-white text-lg font-medium hover:bg-white/20 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {d}
                    </button>
                  ))}
                  <button type="button" onClick={backspacePin} className="h-14 rounded-lg bg-white/10 text-white hover:bg-white/20 active:scale-95 flex items-center justify-center">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <button type="button" onClick={() => appendPinDigit("0")} disabled={isLocked} className="h-14 rounded-lg bg-white/10 text-white text-lg font-medium hover:bg-white/20 active:scale-95 transition-all disabled:opacity-50">
                    0
                  </button>
                  <button
                    type="button"
                    onClick={submitPin}
                    disabled={isLocked || pin.length < 4 || pinMutation.isPending}
                    className="h-14 rounded-lg bg-teal-500 text-white font-semibold hover:bg-teal-400 active:scale-95 disabled:opacity-50"
                  >
                    {pinMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Enter"}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setMode("password")}
                  className="w-full text-center text-sm text-teal-400 hover:text-teal-300"
                >
                  Use password instead
                </button>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-slate-500 text-xs mt-6">
          Demo: admin / admin123 &nbsp;|&nbsp; cashier1 / cash123 (PIN: 1234)
        </p>
      </div>
    </div>
  );
}
