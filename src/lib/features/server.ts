import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { OPEN_ENTITLEMENTS, type Entitlements, type FeatureKey, isFeatureOn } from "./registry";

/**
 * The signed-in user's organization entitlements, loaded once per request
 * (the app layout and every module gate share the same result).
 */
export const getEntitlements = cache(async (): Promise<Entitlements> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_entitlements");
  if (error || !data) {
    // Phase A SQL not installed yet: keep the app fully usable.
    return OPEN_ENTITLEMENTS;
  }
  const d = data as any;
  return {
    installed: true,
    organization: d.organization ?? null,
    ads_enabled: d.ads_enabled === true,
    features: d.features || {},
    locked: d.locked || [],
    requests: d.requests || [],
    catalog: d.catalog || [],
  };
});

export async function isEnabledOnServer(key: FeatureKey): Promise<boolean> {
  return isFeatureOn(await getEntitlements(), key);
}
