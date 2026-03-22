import { createNeed, getNeedById, updateNeedStatus } from '../db/needs';
import { CreateNeedInput, Need } from '../types';

/** Classifier output merged into a new need row */
export interface ClassifiedNeedInput {
  need_type: string;
  urgency: string;
  confidence?: number | null;
  category?: string | null;
  request_label?: string | null;
  priority_score?: number | null;
  preference_text?: string | null;
}

export async function createNeedFromInput(
  rawText: string,
  classifiedNeed: ClassifiedNeedInput,
  lat?: number,
  lng?: number,
  userId?: string | null
): Promise<Need> {
  const input: CreateNeedInput = {
    raw_text: rawText,
    need_type: classifiedNeed.need_type,
    urgency: classifiedNeed.urgency,
    confidence: classifiedNeed.confidence ?? null,
    lat: lat ?? null,
    lng: lng ?? null,
  };
  if (classifiedNeed.category !== undefined && classifiedNeed.category !== null && String(classifiedNeed.category).trim() !== '') {
    input.category = classifiedNeed.category;
  }
  if (
    classifiedNeed.request_label !== undefined &&
    classifiedNeed.request_label !== null &&
    String(classifiedNeed.request_label).trim() !== ''
  ) {
    input.request_label = classifiedNeed.request_label;
  }
  if (
    classifiedNeed.priority_score !== undefined &&
    classifiedNeed.priority_score !== null &&
    Number.isFinite(classifiedNeed.priority_score)
  ) {
    input.priority_score = classifiedNeed.priority_score;
  }
  if (
    classifiedNeed.preference_text !== undefined &&
    classifiedNeed.preference_text !== null &&
    String(classifiedNeed.preference_text).trim() !== ''
  ) {
    input.preference_text = classifiedNeed.preference_text;
  }
  if (userId !== undefined && userId !== null && String(userId).trim() !== '') {
    input.user_id = userId;
  }
  return createNeed(input);
}

export async function getNeed(id: string): Promise<Need | null> {
  return getNeedById(id);
}

export async function markNeedMatched(id: string): Promise<Need> {
  return updateNeedStatus(id, 'matched');
}
