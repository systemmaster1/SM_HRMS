import FeatureGate from "@/components/FeatureGate";

/** Blocks the whole /em-report section when the organization does not have this module. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <FeatureGate feature="tasks">{children}</FeatureGate>;
}
