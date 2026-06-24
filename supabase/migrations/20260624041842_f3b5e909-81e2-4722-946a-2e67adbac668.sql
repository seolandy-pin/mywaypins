CREATE TABLE public.channel_last_seen (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES public.youtube_channels(id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, channel_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.channel_last_seen TO authenticated;
GRANT ALL ON public.channel_last_seen TO service_role;

ALTER TABLE public.channel_last_seen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_select_cls" ON public.channel_last_seen
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own_insert_cls" ON public.channel_last_seen
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_update_cls" ON public.channel_last_seen
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_delete_cls" ON public.channel_last_seen
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER set_channel_last_seen_updated_at
  BEFORE UPDATE ON public.channel_last_seen
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX channel_last_seen_user_idx ON public.channel_last_seen(user_id);