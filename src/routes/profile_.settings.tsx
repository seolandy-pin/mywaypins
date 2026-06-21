import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, Mail, Trash2, Loader2 } from "lucide-react";

import { useAuth } from "@/lib/auth/use-auth";
import { supabase } from "@/integrations/supabase/client";
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
import { deleteMyAccount } from "@/lib/api/account.functions";

export const Route = createFileRoute("/profile_/settings")({
  head: () => ({ meta: [{ title: "Settings — WanderPins" }] }),
  component: SettingsScreen,
});

function SettingsScreen() {
  const { user, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const deleteAccount = useServerFn(deleteMyAccount);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteAccount();
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
