/** Row shape for `needs` */
export interface Need {
  id: string;
  raw_text: string;
  need_type: string;
  urgency: string;
  confidence: number | null;
  lat: number | null;
  lng: number | null;
  status: string;
  created_at: string;
}

export interface CreateNeedInput {
  raw_text: string;
  need_type: string;
  urgency: string;
  confidence?: number | null;
  lat?: number | null;
  lng?: number | null;
  status?: string;
}

/** Row shape for `resources` */
export interface Resource {
  id: string;
  title: string;
  resource_type: string;
  quantity: number | null;
  expires_at: string | null;
  lat: number | null;
  lng: number | null;
  status: string;
  created_at: string;
}

export interface CreateResourceInput {
  title: string;
  resource_type?: string;
  quantity?: number | null;
  expires_at?: string | null;
  lat?: number | null;
  lng?: number | null;
  status?: string;
}

/** Row shape for `matches` */
export interface Match {
  id: string;
  need_id: string | null;
  resource_id: string | null;
  score: number | null;
  distance_km: number | null;
  status: string;
  created_at: string;
}

export interface CreateMatchInput {
  need_id: string;
  resource_id: string;
  score?: number | null;
  distance_km?: number | null;
  status?: string;
}

/** Row shape for `notifications` */
export interface Notification {
  id: string;
  need_id: string | null;
  message_text: string | null;
  voice_url: string | null;
  created_at: string;
}

export interface CreateNotificationInput {
  need_id: string;
  message_text?: string | null;
  voice_url?: string | null;
}
