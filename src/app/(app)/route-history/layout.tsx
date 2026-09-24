import FeatureGate from "@/components/FeatureGate";

/** Blocks the whole /route-history section when the organization does not have this module. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <FeatureGate feature="field.tracking">{children}</FeatureGate>;
}
