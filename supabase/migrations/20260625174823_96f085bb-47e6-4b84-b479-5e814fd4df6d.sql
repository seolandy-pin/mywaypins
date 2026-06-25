-- Migrate dismissed_notifications to use stable YouTube video IDs (text)
-- so dismissals persist across video re-inserts during refresh.

ALTER TABLE public.dismissed_notifications
  DROP CONSTRAINT IF EXISTS dismissed_notifications_pkey;

ALTER TABLE public.dismissed_notifications
  ADD COLUMN IF NOT EXISTS youtube_video_id text;

-- Backfill from existing uuid references where the video still exists.
UPDATE public.dismissed_notifications d
SET youtube_video_id = v.youtube_video_id
FROM public.videos v
WHERE d.youtube_video_id IS NULL
  AND d.video_id IS NOT NULL
  AND v.id = d.video_id;

-- Remove rows we can't migrate (video already deleted, will resurface once).
DELETE FROM public.dismissed_notifications WHERE youtube_video_id IS NULL;

ALTER TABLE public.dismissed_notifications DROP COLUMN video_id;
ALTER TABLE public.dismissed_notifications ALTER COLUMN youtube_video_id SET NOT NULL;

ALTER TABLE public.dismissed_notifications
  ADD CONSTRAINT dismissed_notifications_pkey PRIMARY KEY (user_id, youtube_video_id);
