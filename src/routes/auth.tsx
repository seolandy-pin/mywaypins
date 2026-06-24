import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";
import { Compass, Mail } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — WanderPins" }] }),
  component: AuthScreen,
});

function AuthScreen() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Welcome back!");
      navigate({ to: "/" });
      return;
    }
    const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
    if (error) { setLoading(false); toast.error(error.message); return; }
    if (!data.session) {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) { setLoading(false); toast.error(signInError.message); return; }
    }
    setLoading(false);
    toast.success("Welcome! Account created successfully.");
    navigate({ to: "/" });
  }

  async function handleGoogle() {
    setLoading(true);
    // Capacitor 네이티브 앱에서는 window.location.origin이 'https://localhost'가 되어
    // OAuth provider가 콜백을 보낼 수 없다. 게시된 도메인으로 고정한다.
    const { Capacitor } = await import("@capacitor/core");
    const redirectUri = Capacitor.isNativePlatform()
      ? "https://mywaypins.lovable.app"
      : window.location.origin;
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: redirectUri });
    if (result.error) { toast.error("Google sign-in failed"); setLoading(false); return; }
    if (result.redirected) return;
    navigate({ to: "/" });
  }


  function openForgot() {
    setForgotEmail(email);
    setForgotSent(false);
    setForgotOpen(true);
  }

  async function handleForgotSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotBusy(true);
    try {
      await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
    } catch {
      // Ignore — show generic confirmation regardless to avoid email enumeration
    }
    setForgotBusy(false);
    setForgotSent(true);
  }

  return (
    <div className="safe-top flex min-h-screen flex-col items-center justify-center gap-6 px-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="rounded-2xl gradient-hero p-3 text-primary-foreground"><Compass className="size-7" /></div>
          <h1 className="font-display text-3xl font-bold">WanderPins</h1>
          <p className="text-sm text-muted-foreground text-balance">Discover the world through travel videos on a map.</p>
        </div>

        <form onSubmit={handleEmail} className="w-full max-w-sm space-y-3">
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="bg-surface-1 h-12" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="bg-surface-1 h-12" />
            {mode === "signin" && (
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={openForgot}
                  className="text-xs text-primary hover:underline"
                >
                  Forgot Password?
                </button>
              </div>
            )}
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <div className="flex w-full max-w-sm items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> OR <span className="h-px flex-1 bg-border" />
        </div>

        <Button variant="outline" size="lg" className="w-full max-w-sm" onClick={handleGoogle} disabled={loading}>
          Continue with Google
        </Button>

        <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="text-sm text-muted-foreground">
          {mode === "signin" ? "New here? Create an account" : "Have an account? Sign in"}
        </button>

        <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
          <DialogContent className="bg-surface-1 border-border max-w-sm">
            {!forgotSent ? (
              <>
                <DialogHeader>
                  <div className="mx-auto mb-2 rounded-xl gradient-hero p-2.5 text-primary-foreground w-fit">
                    <Mail className="size-5" />
                  </div>
                  <DialogTitle className="text-center">Reset Password</DialogTitle>
                  <DialogDescription className="text-center">
                    Enter your registered email address.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleForgotSubmit} className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="forgot-email">Email</Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="bg-surface-2 h-12"
                      placeholder="you@example.com"
                    />
                  </div>
                  <DialogFooter className="gap-2 sm:gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setForgotOpen(false)}
                      disabled={forgotBusy}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={forgotBusy} className="flex-1">
                      {forgotBusy ? "Sending..." : "Submit"}
                    </Button>
                  </DialogFooter>
                </form>
              </>
            ) : (
              <>
                <DialogHeader>
                  <div className="mx-auto mb-2 rounded-xl gradient-hero p-2.5 text-primary-foreground w-fit">
                    <Mail className="size-5" />
                  </div>
                  <DialogTitle className="text-center">Request Received</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Your password reset request has been received. For security, a temporary password will be sent to your registered email within{" "}
                  <span className="text-foreground font-medium">10 minutes</span>.
                  If you do not receive the email or need urgent assistance, please contact our support team at{" "}
                  <a href="mailto:mywaypins.help@gmail.com" className="text-primary hover:underline">mywaypins.help@gmail.com</a>.
                </p>
                <DialogFooter>
                  <Button onClick={() => setForgotOpen(false)} className="w-full">
                    OK
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
    </div>
  );
}
