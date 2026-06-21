import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Shield } from "lucide-react";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — MyWayPins" },
      {
        name: "description",
        content:
          "MyWayPins Privacy Policy: learn how we collect, use, and protect your data.",
      },
    ],
  }),
  component: PrivacyScreen,
});

function PrivacyScreen() {
  return (
    <>
      <header className="safe-top flex items-center gap-2 px-5 pt-4">
        <Link
          to="/profile"
          className="-ml-1 flex size-9 items-center justify-center rounded-full active:bg-surface-1"
          aria-label="Back"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="font-display text-xl font-bold">Privacy Policy</h1>
      </header>

      <div className="px-5 pb-10 pt-2">
        <div className="mb-5 flex items-center gap-3 rounded-2xl bg-card p-4">
          <div className="rounded-xl bg-primary/10 p-2.5">
            <Shield className="size-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">MyWayPins</p>
            <p className="text-xs text-muted-foreground">Effective Date: June 2026</p>
          </div>
        </div>

        <section className="flex flex-col gap-4 text-sm text-muted-foreground">
          <p className="text-foreground">
            MyWayPins respects your privacy. We collect only the information
            necessary to provide and improve our services, including account
            information (email), device tokens for push notifications (FCM), saved
            travel pins, collections, and app usage data.
          </p>

          <p className="text-foreground">
            We do not sell personal information to third parties.
          </p>

          <div>
            <p className="mb-2 font-semibold text-foreground">
              Information may be used to:
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Provide and maintain the service</li>
              <li>Deliver push notifications for new video updates</li>
              <li>Improve app performance and user experience</li>
              <li>Respond to support requests</li>
              <li>Ensure platform security</li>
            </ul>
          </div>

          <div>
            <p className="mb-1 font-semibold text-foreground">
              Data Deletion & Account Removal
            </p>
            <p>
              Users have full control over their data. You can delete your account
              and remove all associated personal data instantly at any time through
              the Account Deletion feature inside the app settings{" "}
              <span className="text-foreground">
                (Profile → Settings → Delete Account)
              </span>
              .
            </p>
            <p className="mt-2">
              Alternatively, users may request account deletion by contacting us at:{" "}
              <a
                href="mailto:mywaypins.help@gmail.com"
                className="ml-1 text-primary underline"
              >
                mywaypins.help@gmail.com
              </a>
            </p>
          </div>

          <p className="text-foreground">
            By using MyWayPins, you agree to this Privacy Policy.
          </p>
        </section>
      </div>
    </>
  );
}
