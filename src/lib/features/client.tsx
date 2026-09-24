"use client";

import { createContext, useContext } from "react";
import { OPEN_ENTITLEMENTS, type Entitlements, type FeatureKey, isFeatureOn } from "./registry";

const Ctx = createContext<Entitlements>(OPEN_ENTITLEMENTS);

export function EntitlementsProvider({ value, children }: { value: Entitlements; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEntitlements(): Entitlements {
  return useContext(Ctx);
}

/** true when the organization has this module / sub-feature enabled. */
export function useFeature(key: FeatureKey): boolean {
  return isFeatureOn(useContext(Ctx), key);
}
