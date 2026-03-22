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
  user_id?: string | null;
  category?: string | null;
  request_label?: string | null;
  priority_score?: number | null;
  preference_text?: string | null;
}

export interface CreateNeedInput {
  raw_text: string;
  need_type: string;
  urgency: string;
  confidence?: number | null;
  lat?: number | null;
  lng?: number | null;
  status?: string;
  user_id?: string | null;
  category?: string | null;
  request_label?: string | null;
  priority_score?: number | null;
  preference_text?: string | null;
}

/** Row shape for `resources` */
export interface Resource {
  id: string;
  title: string;
  resource_type: string;
  category?: string | null;
  quantity: number | null;
  original_price?: number | null;
  discounted_price?: number | null;
  expires_at: string | null;
  lat: number | null;
  lng: number | null;
  status: string;
  created_at: string;
  provider_id?: string | null;
}

export interface CreateResourceInput {
  title: string;
  resource_type?: string;
  category?: string | null;
  quantity?: number | null;
  original_price?: number | null;
  discounted_price?: number | null;
  expires_at?: string | null;
  lat?: number | null;
  lng?: number | null;
  status?: string;
  provider_id?: string | null;
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
  need_id?: string | null;
  message_text?: string | null;
  voice_url?: string | null;
}

/** Row shape for `reservations` */
export interface Reservation {
  id: string;
  user_id: string | null;
  resource_id: string;
  status: string;
  phone_number: string | null;
  created_at: string;
  /** Present only if the DB table includes this column */
  customer_name?: string | null;
}

/** Fields accepted by `insertReservation` (optional DB columns omitted from payload when unset). */
export interface InsertReservationInput {
  user_id: string;
  resource_id: string;
  phone_number: string | null;
  status?: string;
  customer_name?: string | null;
}

export interface CreateReservationInput {
  user_id: string;
  resource_id: string;
  phone_number?: string | null;
  status?: string;
  customer_name?: string | null;
}
