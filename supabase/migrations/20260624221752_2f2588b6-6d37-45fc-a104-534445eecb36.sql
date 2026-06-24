
CREATE TABLE public.dismissed_notifications (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id UUID NOT NULL,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, video_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dismissed_notifications TO authenticated;
GRANT ALL ON public.dismissed_notifications TO service_role;
ALTER TABLE public.dismissed_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own dismissed notifications"
  ON public.dismissed_notifications FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_dismissed_notifications_user ON public.dismissed_notifications(user_id);
