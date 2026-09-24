import FeatureGate from "@/components/FeatureGate";

/** Blocks the whole /tracking section when the organization does not have this module. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <FeatureGate feature="field">{children}</FeatureGate>;
}
