import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// Module-level cache so remounting components (route changes) start with the
// last known session instead of flashing a "logged out" state while
// getSession() resolves — that flash was clearing the map pins briefly.
let cachedSession: Session | null = null;
let cacheReady = false;

export function useAuth() {
  const [session, setSession] = useState<Session | null>(cachedSession);
  const [user, setUser] = useState<User | null>(cachedSession?.user ?? null);
  const [loading, setLoading] = useState(!cacheReady);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      cachedSession = sess;
      cacheReady = true;
      setSession(sess);
      setUser(sess?.user ?? null);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      cachedSession = data.session;
      cacheReady = true;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, user, loading, isAuthenticated: !!user };
}
