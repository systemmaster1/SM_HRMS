// Catch-all for dashboard modules not yet built — shows a friendly placeholder
// instead of a 404. Specific routes (inventory, masters, settings…) take priority.
import { ComingSoon } from "@/components/coming-soon";

export const dynamic = "force-dynamic";

export default async function ModulePlaceholder({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const title = (slug?.[0] ?? "Module").replace(/-/g, " ");
  return <ComingSoon title={title} />;
}
