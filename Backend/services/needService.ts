import { createNeed, getNeedById, updateNeedStatus } from '../db/needs';
import { Need } from '../types';

/** Classifier output merged into a new need row */
export interface ClassifiedNeedInput {
  need_type: string;
  urgency: string;
  confidence?: number | null;
}

export async function createNeedFromInput(
  rawText: string,
  classifiedNeed: ClassifiedNeedInput,
  lat?: number,
  lng?: number
): Promise<Need> {
  return createNeed({
    raw_text: rawText,
    need_type: classifiedNeed.need_type,
    urgency: classifiedNeed.urgency,
    confidence: classifiedNeed.confidence ?? null,
    lat: lat ?? null,
    lng: lng ?? null,
  });
}

export async function getNeed(id: string): Promise<Need | null> {
  return getNeedById(id);
}

export async function markNeedMatched(id: string): Promise<Need> {
  return updateNeedStatus(id, 'matched');
}
