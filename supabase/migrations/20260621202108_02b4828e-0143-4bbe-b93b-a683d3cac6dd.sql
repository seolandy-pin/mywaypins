
DROP POLICY IF EXISTS "Authed users can submit channels" ON public.youtube_channels;
DROP POLICY IF EXISTS "Claimers can update their channel" ON public.youtube_channels;

DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);
