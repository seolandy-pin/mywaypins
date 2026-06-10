import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useAuth } from "@/lib/auth/use-auth";
import { submitChannel } from "@/lib/api/channels.functions";
import { toast } from "sonner";
import { ChevronLeft, Youtube, Sparkles } from "lucide-react";

export const Route = createFileRoute("/submit")({
  head: () => ({ meta: [{ title: "Submit a channel — WanderPins" }] }),
  component: SubmitScreen,
});

function SubmitScreen() {
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useAuth();
  const submit = useServerFn(submitChannel);
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  if (!isAuthenticated) {
    return (
      <div className="safe-top flex min-h-[70vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <Youtube className="size-10 text-primary" />
        <h2 className="font-display text-2xl font-bold">Sign in to submit a channel</h2>
        <Button asChild size="lg"><Link to="/auth">Sign in</Link></Button>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await submit({ data: { channel_url: url.trim(), channel_name: name.trim() || undefined } });
      toast.success("Channel submitted! AI is extracting locations…");
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="safe-top flex items-center gap-2 px-5 pt-4">
        <Link to="/" className="rounded-full p-1 active:bg-surface-1"><ChevronLeft className="size-5" /></Link>
        <h1 className="font-display text-xl font-bold">Submit a channel</h1>
      </header>

      <div className="mx-5 mt-4 flex gap-3 rounded-2xl gradient-hero p-4 text-primary-foreground">
        <Sparkles className="size-5 shrink-0" />
        <p className="text-sm">Our AI watches every video's title, description, and tags to pin it to the right place on the map.</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4 px-5">
        <div className="space-y-1.5">
          <Label htmlFor="url">YouTube channel URL</Label>
          <Input id="url" required placeholder="https://youtube.com/@channel" value={url} onChange={(e) => setUrl(e.target.value)} className="h-12 bg-surface-1" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="name">Channel name (optional)</Label>
          <Input id="name" placeholder="Drew Binsky" value={name} onChange={(e) => setName(e.target.value)} className="h-12 bg-surface-1" />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={busy || !url}>{busy ? "Submitting…" : "Submit channel"}</Button>
      </form>
    </>
  );
}
