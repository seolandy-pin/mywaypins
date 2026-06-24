CREATE TABLE public.youtube_search_cache (
  query text PRIMARY KEY,
  results jsonb NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.youtube_search_cache TO anon, authenticated;
GRANT ALL ON public.youtube_search_cache TO service_role;
ALTER TABLE public.youtube_search_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read cache" ON public.youtube_search_cache FOR SELECT USING (true);
CREATE INDEX idx_youtube_search_cache_expires ON public.youtube_search_cache(expires_at);