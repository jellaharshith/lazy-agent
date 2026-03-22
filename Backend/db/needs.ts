import { supabase } from '../config/supabase';
import { CreateNeedInput, Need } from '../types';

function extractMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>;
    const parts = [e.message, e.details, e.hint, e.code].filter(
      (v) => v !== undefined && v !== null && String(v).trim() !== ''
    );
    if (parts.length) {
      return parts.map(String).join(' | ');
    }
  }
  return String(err);
}

function dbError(context: string, err: unknown): Error {
  return new Error(`${context}: ${extractMessage(err)}`);
}

/** PostgREST / Supabase: unknown column or schema cache out of date */
function isMissingColumnOrSchemaError(err: unknown): boolean {
  const msg = extractMessage(err);
  return (
    /schema cache/i.test(msg) ||
    /Could not find the ['`]?[\w]+['`]? column/i.test(msg) ||
    /column.*does not exist/i.test(msg) ||
    (typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      String((err as { code?: string }).code) === 'PGRST204')
  );
}

const OPTIONAL_META_KEYS = ['category', 'request_label', 'priority_score', 'preference_text'] as const;

function baseInsertPayload(input: CreateNeedInput): Record<string, unknown> {
  return {
    raw_text: input.raw_text,
    need_type: input.need_type,
    urgency: input.urgency,
    confidence: input.confidence ?? null,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    status: input.status ?? 'open',
  };
}

function withOptionalMetadata(input: CreateNeedInput): Record<string, unknown> {
  const row: Record<string, unknown> = { ...baseInsertPayload(input) };
  if (input.category !== undefined && input.category !== null && String(input.category).trim() !== '') {
    row.category = input.category;
  }
  if (input.request_label !== undefined && input.request_label !== null && String(input.request_label).trim() !== '') {
    row.request_label = input.request_label;
  }
  if (
    input.priority_score !== undefined &&
    input.priority_score !== null &&
    Number.isFinite(input.priority_score)
  ) {
    row.priority_score = input.priority_score;
  }
  if (
    input.preference_text !== undefined &&
    input.preference_text !== null &&
    String(input.preference_text).trim() !== ''
  ) {
    row.preference_text = input.preference_text;
  }
  return row;
}

function withUserId(row: Record<string, unknown>, input: CreateNeedInput): Record<string, unknown> {
  const uid = input.user_id;
  if (uid !== undefined && uid !== null && String(uid).trim() !== '') {
    return { ...row, user_id: uid };
  }
  return { ...row };
}

function stripOptionalMetadata(row: Record<string, unknown>): Record<string, unknown> {
  const next = { ...row };
  for (const k of OPTIONAL_META_KEYS) {
    delete next[k];
  }
  return next;
}

function stripUserId(row: Record<string, unknown>): Record<string, unknown> {
  const next = { ...row };
  delete next.user_id;
  return next;
}

/**
 * PostgREST RETURNING must not list columns missing from its schema cache.
 * Select only columns we actually inserted, plus generated id/created_at.
 */
function selectClauseForInsert(row: Record<string, unknown>): string {
  const keys = new Set<string>(['id', 'created_at', ...Object.keys(row)]);
  return [...keys].join(',');
}

async function insertNeedRow(row: Record<string, unknown>): Promise<Need> {
  const sel = selectClauseForInsert(row);
  const { data, error } = await supabase.from('needs').insert(row).select(sel).single();
  if (error) throw dbError('createNeed', error);
  if (data == null) throw dbError('createNeed', new Error('no row returned'));
  return data as unknown as Need;
}

export async function createNeed(input: CreateNeedInput): Promise<Need> {
  const withMeta = withOptionalMetadata(input);
  const fullRow = withUserId(withMeta, input);

  try {
    return await insertNeedRow(fullRow);
  } catch (first) {
    if (!isMissingColumnOrSchemaError(first)) {
      throw first;
    }
    console.warn(
      '[createNeed] insert with metadata/user failed; retrying without AI metadata columns:',
      extractMessage(first)
    );

    const withoutMeta = withUserId(stripOptionalMetadata(withMeta), input);
    try {
      return await insertNeedRow(withoutMeta);
    } catch (second) {
      if (!isMissingColumnOrSchemaError(second)) {
        throw second;
      }
      console.warn(
        '[createNeed] insert with user_id failed; retrying with base columns only:',
        extractMessage(second)
      );
      const baseOnly = stripUserId(withoutMeta);
      try {
        return await insertNeedRow(baseOnly);
      } catch (third) {
        throw third;
      }
    }
  }
}

export async function listNeedsByUserId(userId: string): Promise<Need[]> {
  const { data, error } = await supabase
    .from('needs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw dbError('listNeedsByUserId', error);
  return (data ?? []) as Need[];
}

export async function getNeedById(id: string): Promise<Need | null> {
  const incoming = id;
  const normalizedId = id.trim().toLowerCase();
  console.log('[getNeedById] incoming id:', JSON.stringify(incoming));
  console.log('[getNeedById] normalized id for query:', JSON.stringify(normalizedId));

  const { data, error } = await supabase.from('needs').select('*').eq('id', normalizedId).limit(1);

  console.log(
    '[getNeedById] Supabase raw response:',
    JSON.stringify({ error: error ?? null, data: data ?? null, rowCount: Array.isArray(data) ? data.length : null })
  );

  if (error) throw dbError('getNeedById', error);

  const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
  console.log('[getNeedById] returned row:', row ? JSON.stringify(row) : 'null');
  return (row as Need) ?? null;
}

export async function updateNeedStatus(id: string, status: string): Promise<Need> {
  const normalizedId = id.trim().toLowerCase();
  const { data, error } = await supabase
    .from('needs')
    .update({ status })
    .eq('id', normalizedId)
    .select('*')
    .single();

  if (error) throw dbError('updateNeedStatus', error);
  return data as Need;
}
