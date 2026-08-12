// UX-1C shared pure-logic helpers for Farmer/Manager Home. No Vue, no API calls -- just
// truthful derivations over data the pages already fetch from existing endpoints. Never
// invents a field-level signal that isn't backed by a real alert/anomaly row.

export type FieldAttentionItem = { fieldId: string; fieldName: string; severity: string };

const SEVERITY_RANK: Record<string, number> = { CRITICAL: 3, HIGH: 2, MEDIUM: 1, LOW: 0 };

// Cross-references field-tagged HIGH/CRITICAL alerts and anomalies (from getAlerts()) against
// the farm's real field list (from getCockpit().farm.fields) to answer "which field needs
// attention first" truthfully. A field only ever appears here because a real alert/anomaly
// row references it -- this is not a fabricated ranking algorithm, just a filter + lookup.
export function deriveFieldAttention(
  fields: Array<{ id: string; name?: string | null }> | undefined,
  alerts: { safetyAlerts?: Array<{ fieldId?: string; severity?: string }>; anomalies?: Array<{ fieldId?: string; severity?: string }> } | undefined,
  limit = 3
): FieldAttentionItem[] {
  const fieldNameById = new Map((fields ?? []).map((field) => [field.id, field.name ?? field.id]));
  const candidates = [...(alerts?.safetyAlerts ?? []), ...(alerts?.anomalies ?? [])].filter(
    (item): item is { fieldId: string; severity: string } => Boolean(item?.fieldId) && fieldNameById.has(item!.fieldId!) && (SEVERITY_RANK[item?.severity ?? ''] ?? 0) >= SEVERITY_RANK.HIGH
  );
  const bestByField = new Map<string, { fieldId: string; severity: string }>();
  for (const item of candidates) {
    const existing = bestByField.get(item.fieldId);
    if (!existing || (SEVERITY_RANK[item.severity] ?? 0) > (SEVERITY_RANK[existing.severity] ?? 0)) bestByField.set(item.fieldId, item);
  }
  return [...bestByField.values()]
    .sort((a, b) => (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0))
    .slice(0, limit)
    .map((item) => ({ fieldId: item.fieldId, fieldName: fieldNameById.get(item.fieldId) ?? item.fieldId, severity: item.severity }));
}

export function countFieldsOk(fields: Array<{ id: string }> | undefined, attention: FieldAttentionItem[]): { total: number; attention: number; ok: number } {
  const total = fields?.length ?? 0;
  return { total, attention: attention.length, ok: Math.max(0, total - attention.length) };
}

// Only ever called with a real ISO timestamp from the LIVE data envelope (http.ts sets
// lastUpdatedAt to null for MOCK/ERROR/OFFLINE results) -- never invents a freshness claim.
export function formatFreshness(lastUpdatedAt?: string | null): string | null {
  if (!lastUpdatedAt) return null;
  const elapsedMs = Date.now() - new Date(lastUpdatedAt).getTime();
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return null;
  const minutes = Math.floor(elapsedMs / 60000);
  if (minutes < 1) return '刚刚更新';
  if (minutes < 60) return `更新于 ${minutes} 分钟前`;
  return `更新于 ${Math.floor(minutes / 60)} 小时前`;
}
