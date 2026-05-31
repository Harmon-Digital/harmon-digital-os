import { supabase } from "./supabaseClient";
import { KPI_DEFINITIONS } from "@/config/kpiConfig";

export async function calculateKpiValue(kpiDef, periodStart, teamMemberId = null) {
  if (kpiDef.calcType !== "auto" || !kpiDef.source) return null;

  const { table, filter, aggregate, field, dateField } = kpiDef.source;

  // Calculate week end (periodStart is Monday, end is next Monday)
  const start = new Date(periodStart + "T00:00:00Z");
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  const periodEnd = end.toISOString().split("T")[0];

  let query = supabase.from(table).select(field || "*");

  // Apply static filters
  if (filter) {
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value);
      }
    });
  }

  // Apply team member filter
  if (teamMemberId && kpiDef.perMember && kpiDef.memberField) {
    query = query.eq(kpiDef.memberField, teamMemberId);
  }

  // Apply date range (Mon–Sun week window)
  if (dateField) {
    query = query.gte(dateField, periodStart).lt(dateField, periodEnd);
  }

  const { data, error } = await query;
  if (error) throw error;
  // A null payload means the request errored without `error` being set, or
  // RLS hid the rows — don't silently persist that as a real 0.
  if (!Array.isArray(data)) throw new Error(`KPI ${kpiDef.slug}: query returned no data`);

  if (aggregate === "count") {
    return data.length;
  } else if (aggregate === "sum") {
    if (!field) throw new Error(`KPI ${kpiDef.slug}: sum aggregate requires a field`);
    const total = data.reduce((sum, row) => sum + (Number(row[field]) || 0), 0);
    // Round to cents to avoid float drift when summing decimal/money columns.
    return Math.round(total * 100) / 100;
  }

  throw new Error(`KPI ${kpiDef.slug}: unknown aggregate ${aggregate}`);
}

export async function calculateAllAutoKpis(periodStart, teamMemberId = null) {
  let autoKpis = KPI_DEFINITIONS.filter((k) => k.calcType === "auto");

  // When calculating for a specific member, only include per-member KPIs
  if (teamMemberId) {
    autoKpis = autoKpis.filter((k) => k.perMember);
  }

  const results = {};

  await Promise.all(
    autoKpis.map(async (kpi) => {
      try {
        results[kpi.slug] = await calculateKpiValue(kpi, periodStart, teamMemberId);
      } catch (err) {
        console.error(`Error calculating KPI ${kpi.slug}:`, err);
        results[kpi.slug] = null;
      }
    })
  );

  return results;
}

export async function saveEntries(entries) {
  const results = [];

  for (const entry of entries) {
    const teamMemberId = entry.team_member_id || null;

    // Find existing entry matching slug + period + team_member_id
    let matchQuery = supabase
      .from("kpi_entries")
      .select("id")
      .eq("slug", entry.slug)
      .eq("month", entry.month);

    if (teamMemberId) {
      matchQuery = matchQuery.eq("team_member_id", teamMemberId);
    } else {
      matchQuery = matchQuery.is("team_member_id", null);
    }

    const { data: existing, error: matchError } = await matchQuery.maybeSingle();
    if (matchError) throw matchError;

    if (existing) {
      const { data, error } = await supabase
        .from("kpi_entries")
        .update({
          actual_value: entry.actual_value,
          ...(entry.target_value !== undefined && { target_value: entry.target_value }),
          ...(entry.bonus_amount !== undefined && { bonus_amount: entry.bonus_amount }),
          ...(entry.notes !== undefined && { notes: entry.notes }),
        })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw error;
      results.push(data);
    } else {
      const { data, error } = await supabase
        .from("kpi_entries")
        .insert({
          slug: entry.slug,
          month: entry.month,
          actual_value: entry.actual_value ?? 0,
          target_value: entry.target_value ?? null,
          bonus_amount: entry.bonus_amount ?? null,
          notes: entry.notes ?? null,
          team_member_id: teamMemberId,
        })
        .select()
        .single();
      if (error) throw error;
      results.push(data);
    }
  }

  return results;
}

export async function fetchEntriesForRange(startPeriod, endPeriod, teamMemberId = null) {
  let query = supabase
    .from("kpi_entries")
    .select("*")
    .gte("month", startPeriod)
    .lte("month", endPeriod)
    .order("month", { ascending: true });

  if (teamMemberId) {
    query = query.eq("team_member_id", teamMemberId);
  } else {
    query = query.is("team_member_id", null);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}
