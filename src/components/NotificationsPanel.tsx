import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell, BellOff } from "lucide-react";
import type { NotificationItem } from "@/lib/hooks/use-new-video-notifications";

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function NotificationsPanel({
  trigger,
  items,
  unreadCount,
  onItemClick,
  onMarkAllRead,
  open,
  onOpenChange,
}: {
  trigger: React.ReactNode;
  items: NotificationItem[];
  unreadCount: number;
  onItemClick: (item: NotificationItem) => void;
  onMarkAllRead: () => void;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[320px] overflow-hidden p-0"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Bell className="size-4 text-primary" />
            <span className="font-display text-sm font-bold">Notifications</span>
            {unreadCount > 0 && (
              <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={onMarkAllRead}
              className="cursor-pointer text-[11px] font-medium text-primary hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center text-muted-foreground">
              <BellOff className="size-6" />
              <p className="text-xs">No new videos yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((it) => (
                <li key={it.videoDbId}>
                  <button
                    type="button"
                    onClick={() => onItemClick(it)}
                    className={`flex w-full cursor-pointer items-start gap-3 px-3 py-2.5 text-left transition hover:bg-surface-1 active:scale-[0.99] ${
                      it.unread ? "bg-primary/5" : ""
                    }`}
                  >
                    <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-surface-2">
                      {it.thumbnailUrl ? (
                        <img
                          src={it.thumbnailUrl}
                          alt={it.title}
                          className="size-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[11px] font-semibold text-muted-foreground">
                          {it.channelName}
                        </span>
                        {it.unread && (
                          <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                        )}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[12px] font-medium leading-tight">
                        {it.title}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {relativeTime(it.publishedAt)}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
