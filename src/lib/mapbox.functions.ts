import { createServerFn } from "@tanstack/react-start";

export const getMapboxToken = createServerFn({ method: "GET" }).handler(async () => {
  return { token: process.env.MAPBOX_API_KEY ?? "" };
});
