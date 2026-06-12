import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth/use-auth";
import { listMyCollections } from "@/lib/collections.functions";

export type MyCollection = {
  id: string;
  name: string;
  cover_image_url: string | null;
  video_ids: string[];
  item_count: number;
};

export function useMyCollections() {
  const { isAuthenticated } = useAuth();
  const fn = useServerFn(listMyCollections);
  const q = useQuery({
    queryKey: ["my-collections"],
    enabled: isAuthenticated,
    queryFn: () => fn() as Promise<MyCollection[]>,
  });
  return {
    collections: q.data ?? [],
    loading: q.isLoading,
    refetch: q.refetch,
  };
}
