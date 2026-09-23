/**
 * Supabase returns at most 1000 rows per request (the project's "Max rows"
 * setting), even when you ask for .limit(5000). Anything beyond that is
 * silently dropped. This helper pages through with .range() until every row
 * has been read.
 *
 * Usage:
 *   const rows = await fetchAll((from, to) =>
 *     supabase.from("attendance").select("*").eq("company_id", id)
 *       .order("work_date", { ascending: false }).order("id").range(from, to));
 *
 * Always add a unique tie-breaker order (e.g. .order("id")) so pages never
 * overlap or skip rows.
 */
const PAGE = 1000;

export async function fetchAll<T = any>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
  hardCap = 200_000,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < hardCap; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(error.message || String(error));
    const rows = data || [];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}
