import { getEntitlements } from "@/lib/features/server";
import { FEATURES, isFeatureOn, type FeatureKey } from "@/lib/features/registry";
import ModuleLocked from "@/components/ModuleLocked";

/**
 * Server-side route guard. Used by each module's layout.tsx, so a disabled
 * module cannot be opened by typing its URL. (The database blocks its data
 * independently, so this is a second wall, not the only one.)
 */
export default async function FeatureGate({ feature, children }: { feature: FeatureKey; children: React.ReactNode }) {
  const ent = await getEntitlements();
  if (!isFeatureOn(ent, feature)) {
    // Name the missing piece: the module itself, or its parent if that is off.
    const info = FEATURES[feature];
    const parentOff = info.parent && !isFeatureOn(ent, info.parent);
    const shown = parentOff ? FEATURES[info.parent!] : info;
    return <ModuleLocked name={shown.label} description={shown.description} />;
  }
  return <>{children}</>;
}
