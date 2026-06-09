
-- Tighten INSERT policies (avoid blanket true)
DROP POLICY IF EXISTS "Authed users can submit channels" ON public.youtube_channels;
CREATE POLICY "Authed users can submit channels" ON public.youtube_channels
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- Lock down SECURITY DEFINER helpers
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
