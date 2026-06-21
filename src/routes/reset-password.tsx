import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset Password — MyWayPins" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  // The recovery hash (#access_token=...&type=recovery) is parsed by Supabase
  // on load and the PASSWORD_RECOVERY event opens the global modal rendered
  // in the root layout. We just bounce to home so the modal appears over the map.
  return <Navigate to="/" />;
}
