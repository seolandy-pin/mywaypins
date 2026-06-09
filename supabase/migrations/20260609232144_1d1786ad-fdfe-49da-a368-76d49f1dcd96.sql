
-- =========================
-- PROFILES (1:1 with auth.users)
-- =========================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================
-- YOUTUBE CHANNELS
-- =========================
CREATE TABLE public.youtube_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_channel_id TEXT UNIQUE NOT NULL,
  channel_url TEXT,
  name TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  subscriber_count BIGINT DEFAULT 0,
  video_count INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  is_currently_traveling BOOLEAN DEFAULT false,
  current_location TEXT,
  claimed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.youtube_channels TO anon, authenticated;
GRANT INSERT, UPDATE ON public.youtube_channels TO authenticated;
GRANT ALL ON public.youtube_channels TO service_role;
ALTER TABLE public.youtube_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Channels are viewable by everyone" ON public.youtube_channels FOR SELECT USING (true);
CREATE POLICY "Authed users can submit channels" ON public.youtube_channels FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Claimers can update their channel" ON public.youtube_channels FOR UPDATE TO authenticated USING (claimed_by = auth.uid());
CREATE TRIGGER yt_channels_set_updated_at BEFORE UPDATE ON public.youtube_channels FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- SUBMITTED CHANNELS (queue)
-- =========================
CREATE TABLE public.submitted_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  channel_url TEXT NOT NULL,
  channel_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  resolved_channel_id UUID REFERENCES public.youtube_channels(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.submitted_channels TO authenticated;
GRANT ALL ON public.submitted_channels TO service_role;
ALTER TABLE public.submitted_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see their own submissions" ON public.submitted_channels FOR SELECT TO authenticated USING (submitted_by = auth.uid());
CREATE POLICY "Authed users can submit" ON public.submitted_channels FOR INSERT TO authenticated WITH CHECK (submitted_by = auth.uid());

-- =========================
-- VIDEOS
-- =========================
CREATE TABLE public.videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_video_id TEXT UNIQUE NOT NULL,
  channel_id UUID REFERENCES public.youtube_channels(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  published_at TIMESTAMPTZ,
  view_count BIGINT DEFAULT 0,
  like_count BIGINT DEFAULT 0,
  duration_seconds INTEGER,
  tags TEXT[],
  ai_processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.videos TO anon, authenticated;
GRANT ALL ON public.videos TO service_role;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Videos viewable by everyone" ON public.videos FOR SELECT USING (true);
CREATE TRIGGER videos_set_updated_at BEFORE UPDATE ON public.videos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- PLACES (countries / cities / landmarks normalized)
-- =========================
CREATE TABLE public.places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('country','city','landmark','region')),
  country_code TEXT,
  country_name TEXT,
  city_name TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX places_latlng_idx ON public.places (latitude, longitude);
CREATE INDEX places_kind_idx ON public.places (kind);
GRANT SELECT ON public.places TO anon, authenticated;
GRANT ALL ON public.places TO service_role;
ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Places viewable by everyone" ON public.places FOR SELECT USING (true);

-- =========================
-- PINS (video <-> place geo points)
-- =========================
CREATE TABLE public.pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  place_id UUID REFERENCES public.places(id) ON DELETE SET NULL,
  channel_id UUID REFERENCES public.youtube_channels(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  label TEXT,
  pin_type TEXT NOT NULL DEFAULT 'new' CHECK (pin_type IN ('trending','new','featured','traveling')),
  sequence_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX pins_latlng_idx ON public.pins (latitude, longitude);
CREATE INDEX pins_video_idx ON public.pins (video_id);
GRANT SELECT ON public.pins TO anon, authenticated;
GRANT ALL ON public.pins TO service_role;
ALTER TABLE public.pins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Pins viewable by everyone" ON public.pins FOR SELECT USING (true);

-- =========================
-- TRAVEL ROUTES (ordered list of pins per video)
-- =========================
CREATE TABLE public.travel_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  name TEXT,
  geometry JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.travel_routes TO anon, authenticated;
GRANT ALL ON public.travel_routes TO service_role;
ALTER TABLE public.travel_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Routes viewable by everyone" ON public.travel_routes FOR SELECT USING (true);

-- =========================
-- FAVORITES (saved places + saved videos)
-- =========================
CREATE TABLE public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('video','place','pin')),
  video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE,
  place_id UUID REFERENCES public.places(id) ON DELETE CASCADE,
  pin_id UUID REFERENCES public.pins(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, target_type, video_id, place_id, pin_id)
);
GRANT SELECT, INSERT, DELETE ON public.favorites TO authenticated;
GRANT ALL ON public.favorites TO service_role;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their favorites" ON public.favorites FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =========================
-- FOLLOWERS (user follows channel)
-- =========================
CREATE TABLE public.followers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES public.youtube_channels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, channel_id)
);
GRANT SELECT, INSERT, DELETE ON public.followers TO authenticated;
GRANT ALL ON public.followers TO service_role;
ALTER TABLE public.followers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their follows" ON public.followers FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Follows visible to owner" ON public.followers FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- =========================
-- COLLECTIONS (user travel collections)
-- =========================
CREATE TABLE public.collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT true,
  cover_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collections TO authenticated;
GRANT SELECT ON public.collections TO anon;
GRANT ALL ON public.collections TO service_role;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public collections viewable by all" ON public.collections FOR SELECT USING (is_public = true OR auth.uid() = user_id);
CREATE POLICY "Users manage their collections" ON public.collections FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER collections_set_updated_at BEFORE UPDATE ON public.collections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.collection_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE,
  place_id UUID REFERENCES public.places(id) ON DELETE CASCADE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collection_items TO authenticated;
GRANT SELECT ON public.collection_items TO anon;
GRANT ALL ON public.collection_items TO service_role;
ALTER TABLE public.collection_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Collection items follow collection visibility" ON public.collection_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.collections c WHERE c.id = collection_id AND (c.is_public = true OR c.user_id = auth.uid()))
);
CREATE POLICY "Owner manages collection items" ON public.collection_items FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.collections c WHERE c.id = collection_id AND c.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.collections c WHERE c.id = collection_id AND c.user_id = auth.uid())
);

-- =========================
-- NOTIFICATIONS
-- =========================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see their notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users mark their notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
