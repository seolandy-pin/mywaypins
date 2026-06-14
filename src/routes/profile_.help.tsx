import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, HelpCircle, Mail, MessageCircleQuestion, Shield, FileText, Info, Smartphone } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/profile_/help")({
  head: () => ({ meta: [{ title: "Help & Support — WanderPins" }] }),
  component: HelpSupportScreen,
});

function HelpSupportScreen() {
  return (
    <>
      <header className="safe-top flex items-center gap-2 px-5 pt-4">
        <Link to="/profile" className="rounded-full p-1 active:bg-surface-1">
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="font-display text-xl font-bold">Help & Support</h1>
      </header>

      <div className="px-5 pt-2 pb-2">
        <p className="text-sm text-muted-foreground">
          Need help with your journey? We’re here to help.
        </p>
      </div>

      <div className="px-5 pb-10">
        <Accordion type="single" collapsible className="flex flex-col gap-3">
          {/* Contact Support */}
          <CardWrap value="contact">
            <AccordionTrigger className="px-4 py-4 text-sm font-semibold hover:no-underline [&>svg]:text-primary">
              <span className="flex items-center gap-3">
                <Mail className="size-4 text-primary" />
                Contact Support
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="flex flex-col gap-3 text-sm text-muted-foreground">
                <p>
                  Need help with MyWayPins? Contact our support team anytime.
                </p>
                <div className="space-y-1">
                  <p>
                    <span className="text-foreground font-medium">Email:</span>{" "}
                    mywaypins.help@gmail.com
                  </p>
                  <p>
                    <span className="text-foreground font-medium">Response Time:</span>{" "}
                    24–48 hours
                  </p>
                </div>
                <a
                  href="mailto:mywaypins.help@gmail.com?subject=MyWayPins%20Support%20Request"
                  className="mt-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity active:opacity-90"
                >
                  <Mail className="size-4" />
                  Contact Support
                </a>
              </div>
            </AccordionContent>
          </CardWrap>

          {/* FAQ */}
          <CardWrap value="faq">
            <AccordionTrigger className="px-4 py-4 text-sm font-semibold hover:no-underline [&>svg]:text-primary">
              <span className="flex items-center gap-3">
                <MessageCircleQuestion className="size-4 text-primary" />
                Frequently Asked Questions
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="flex flex-col gap-4 text-sm text-muted-foreground">
                <Qa
                  q="How do I save a YouTube location?"
                  a="Save a travel video and pin its location directly to your personal map."
                />
                <Qa
                  q="Can I create my own travel collections?"
                  a="Yes. You can organize saved destinations into custom collections."
                />
                <Qa
                  q="Can I follow other travelers?"
                  a="Yes. Follow travelers and creators to discover new destinations and travel ideas."
                />
                <Qa
                  q="How do I report incorrect information?"
                  a="Please contact us at mywaypins.help@gmail.com."
                />
                <Qa
                  q="Is MyWayPins free to use?"
                  a="Yes. Core features are available for all users."
                />
                <Qa
                  q="Can I edit or remove my saved pins?"
                  a="Yes. You can edit, organize, or remove saved pins anytime."
                />
                <Qa
                  q="How do I request a new feature?"
                  a="Send your suggestions to mywaypins.help@gmail.com."
                />
              </div>
            </AccordionContent>
          </CardWrap>

          {/* Privacy Policy */}
          <CardWrap value="privacy">
            <AccordionTrigger className="px-4 py-4 text-sm font-semibold hover:no-underline [&>svg]:text-primary">
              <span className="flex items-center gap-3">
                <Shield className="size-4 text-primary" />
                Privacy Policy
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="flex flex-col gap-3 text-sm text-muted-foreground">
                <p>MyWayPins respects your privacy.</p>
                <p>
                  We collect only the information necessary to provide and improve our services, including account information, saved travel pins, collections, and app usage data.
                </p>
                <p>We do not sell personal information to third parties.</p>
                <p className="text-foreground font-medium">Information may be used to:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>Provide and maintain the service</li>
                  <li>Improve app performance</li>
                  <li>Improve user experience</li>
                  <li>Respond to support requests</li>
                  <li>Ensure platform security</li>
                </ul>
                <p>
                  Users may request account deletion and data removal by contacting:{" "}
                  <a
                    href="mailto:mywaypins.help@gmail.com"
                    className="text-primary underline"
                  >
                    mywaypins.help@gmail.com
                  </a>
                </p>
                <p>By using MyWayPins, you agree to this Privacy Policy.</p>
              </div>
            </AccordionContent>
          </CardWrap>

          {/* Terms of Service */}
          <CardWrap value="terms">
            <AccordionTrigger className="px-4 py-4 text-sm font-semibold hover:no-underline [&>svg]:text-primary">
              <span className="flex items-center gap-3">
                <FileText className="size-4 text-primary" />
                Terms of Service
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="flex flex-col gap-3 text-sm text-muted-foreground">
                <p>
                  By using MyWayPins, you agree to use the service responsibly and in compliance with applicable laws.
                </p>
                <p className="text-foreground font-medium">Users are responsible for:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>Content they save or share</li>
                  <li>Maintaining account security</li>
                  <li>Respecting intellectual property rights</li>
                </ul>
                <p>
                  MyWayPins reserves the right to suspend accounts that violate these terms.
                </p>
                <p>The service is provided “as is” without warranties.</p>
                <p>
                  For questions:{" "}
                  <a
                    href="mailto:mywaypins.help@gmail.com"
                    className="text-primary underline"
                  >
                    mywaypins.help@gmail.com
                  </a>
                </p>
              </div>
            </AccordionContent>
          </CardWrap>

          {/* About */}
          <CardWrap value="about">
            <AccordionTrigger className="px-4 py-4 text-sm font-semibold hover:no-underline [&>svg]:text-primary">
              <span className="flex items-center gap-3">
                <Info className="size-4 text-primary" />
                About MyWayPins
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="flex flex-col gap-3 text-sm text-muted-foreground">
                <p>
                  MyWayPins helps travelers discover, save, organize, and revisit destinations inspired by YouTube videos and travel content.
                </p>
                <p className="text-foreground font-medium">Our Mission:</p>
                <p className="text-foreground italic">“Turn travel inspiration into real destinations.”</p>
                <p className="text-foreground font-medium">Features:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>Save travel locations</li>
                  <li>Create collections</li>
                  <li>Follow travelers and creators</li>
                  <li>Discover new destinations</li>
                  <li>Build your own travel map</li>
                </ul>
                <p>Thank you for being part of the MyWayPins community.</p>
              </div>
            </AccordionContent>
          </CardWrap>

          {/* App Version */}
          <CardWrap value="version">
            <AccordionTrigger className="px-4 py-4 text-sm font-semibold hover:no-underline [&>svg]:text-primary">
              <span className="flex items-center gap-3">
                <Smartphone className="size-4 text-primary" />
                App Version
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                <p>
                  <span className="text-foreground font-medium">Version:</span> 1.0.0
                </p>
                <p>
                  <span className="text-foreground font-medium">Build:</span> MVP Release
                </p>
                <p className="mt-1 text-xs">Copyright © 2026 MyWayPins</p>
              </div>
            </AccordionContent>
          </CardWrap>
        </Accordion>
      </div>
    </>
  );
}

function CardWrap({
  value,
  children,
}: {
  value: string;
  children: React.ReactNode;
}) {
  return (
    <AccordionItem
      value={value}
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
    >
      {children}
    </AccordionItem>
  );
}

function Qa({ q, a }: { q: string; a: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="font-medium text-foreground">{q}</p>
      <p>{a}</p>
    </div>
  );
}
