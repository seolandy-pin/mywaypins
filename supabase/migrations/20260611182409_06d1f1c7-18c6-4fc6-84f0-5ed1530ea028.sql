-- Grant Data API access to all public tables (RLS policies still control row access)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.favorites TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collection_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.followers TO authenticated;
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT ON public.submitted_channels TO authenticated;
GRANT SELECT ON public.pins TO authenticated;
GRANT SELECT ON public.places TO authenticated;
GRANT SELECT ON public.videos TO authenticated;
GRANT SELECT ON public.travel_routes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.youtube_channels TO authenticated;

-- Public read access for tables with "viewable by everyone" policies
GRANT SELECT ON public.pins TO anon;
GRANT SELECT ON public.places TO anon;
GRANT SELECT ON public.videos TO anon;
GRANT SELECT ON public.youtube_channels TO anon;
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.travel_routes TO anon;
GRANT SELECT ON public.collections TO anon;
GRANT SELECT ON public.collection_items TO anon;

-- Service role full access for server-side operations
GRANT ALL ON public.favorites TO service_role;
GRANT ALL ON public.collections TO service_role;
GRANT ALL ON public.collection_items TO service_role;
GRANT ALL ON public.followers TO service_role;
GRANT ALL ON public.notifications TO service_role;
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.submitted_channels TO service_role;
GRANT ALL ON public.pins TO service_role;
GRANT ALL ON public.places TO service_role;
GRANT ALL ON public.videos TO service_role;
GRANT ALL ON public.travel_routes TO service_role;
GRANT ALL ON public.youtube_channels TO service_role;