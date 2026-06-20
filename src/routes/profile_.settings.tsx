import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, Bell, Mail, Trash2, Loader2 } from "lucide-react";

import { useAuth } from "@/lib/auth/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  getFcmVapidKey,
  registerFcmToken,
  unregisterMyFcmTokens,
} from "@/lib/api/fcm.functions";
import { deleteMyAccount } from "@/lib/api/account.functions";
import { FCM_DISABLED_KEY } from "@/lib/hooks/use-fcm-register";

export const Route = createFileRoute("/profile_/settings")({
  head: () => ({ meta: [{ title: "Settings — WanderPins" }] }),
  component: SettingsScreen,
});

function SettingsScreen() {
  const { user, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const fetchKey = useServerFn(getFcmVapidKey);
  const register = useServerFn(registerFcmToken);
  const unregister = useServerFn(unregisterMyFcmTokens);
  const deleteAccount = useServerFn(deleteMyAccount);

  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    const granted = Notification.permission === "granted";
    const disabled = localStorage.getItem(FCM_DISABLED_KEY) === "1";
    setPushEnabled(granted && !disabled);
  }, []);

  async function handlePushToggle(next: boolean) {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      if (next) {
        if (!("Notification" in window) || !("serviceWorker" in navigator)) {
          toast.error("This device doesn't support notifications.");
          return;
        }
        const { key } = await fetchKey();
        if (!key) {
          toast.error("Push notifications are not configured.");
          return;
        }
        const { requestFcmToken } = await import(
          "@/integrations/firebase/messaging.browser"
        );
        const token = await requestFcmToken(key);
        if (!token) {
          toast.error("Notification permission was denied.");
          return;
        }
        await register({ data: { token, userAgent: navigator.userAgent } });
        localStorage.removeItem(FCM_DISABLED_KEY);
        localStorage.setItem("mywaypins:fcm_registered_at", String(Date.now()));
        setPushEnabled(true);
        toast.success("New video notifications turned on.");
      } else {
        await unregister();
        localStorage.setItem(FCM_DISABLED_KEY, "1");
        localStorage.removeItem("mywaypins:fcm_registered_at");
        setPushEnabled(false);
        toast.success("Notifications turned off.");
      }
    } catch (e) {
      console.warn(e);
      toast.error("Couldn't update notification settings.");
    } finally {
      setPushBusy(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteAccount();
      localStorage.removeItem(FCM_DISABLED_KEY);
      localStorage.removeItem("mywaypins:fcm_registered_at");
      await supabase.auth.signOut();
      toast.success("Your account has been deleted.");
      navigate({ to: "/" });
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete account. Please try again.");
      setDeleting(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  }
  if (!isAuthenticated) {
    return (
      <div className="safe-top flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-muted-foreground">Sign in to manage settings.</p>
        <Button asChild>
          <Link to="/auth">Sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <header className="safe-top flex items-center gap-2 px-4 pt-4 pb-2">
        <Link
          to="/profile"
          className="-ml-2 flex size-9 items-center justify-center rounded-full active:bg-surface-1"
          aria-label="Back"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="font-display text-xl font-bold">Settings</h1>
      </header>

      <section className="mt-4 px-5">
        <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Push notifications
        </p>
        <div className="flex items-center gap-3 rounded-2xl bg-card p-4">
          <div className="rounded-xl bg-surface-1 p-2">
            <Bell className="size-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">New YouTube video alerts</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Get notified when channels you follow upload.
            </p>
          </div>
          <Switch
            checked={pushEnabled}
            disabled={pushBusy}
            onCheckedChange={handlePushToggle}
          />
        </div>
      </section>

      <section className="mt-6 px-5 pb-10">
        <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Account &amp; security
        </p>
        <div className="overflow-hidden rounded-2xl bg-card">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="rounded-xl bg-surface-1 p-2">
              <Mail className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-muted-foreground">Signed in as</p>
              <p className="truncate text-sm font-medium">{user?.email}</p>
            </div>
          </div>
          <div className="h-px bg-border" />
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition active:bg-surface-1"
          >
            <div className="rounded-xl bg-destructive/10 p-2">
              <Trash2 className="size-4 text-destructive" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-destructive">Delete account</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Permanently remove your account and data.
              </p>
            </div>
          </button>
        </div>
      </section>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              If you delete your account, all of your saved places and follow data
              will be permanently removed. Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Deleting…
                </>
              ) : (
                "Delete account"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
