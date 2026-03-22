import type { SupabaseClient } from "@supabase/supabase-js";
import type { InsertReservationInput, Reservation } from "../types";

function isLikelyMissingColumnError(message: string): boolean {
  return /could not find the .* column|column .* does not exist|does not exist/i.test(message);
}

function buildReservationPayload(
  input: InsertReservationInput,
  mode: "full" | "minimal"
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    user_id: input.user_id,
    resource_id: input.resource_id,
    phone_number: input.phone_number ?? null,
  };
  if (mode === "minimal") {
    return payload;
  }
  const status = typeof input.status === "string" && input.status.trim() ? input.status.trim() : "reserved";
  payload.status = status;
  const cn =
    typeof input.customer_name === "string" && input.customer_name.trim() ? input.customer_name.trim() : "";
  if (cn) {
    payload.customer_name = cn;
  }
  return payload;
}

export async function insertReservation(
  client: SupabaseClient,
  input: InsertReservationInput
): Promise<Reservation> {
  const tryModes: Array<"full" | "minimal"> = ["full", "minimal"];

  for (let i = 0; i < tryModes.length; i++) {
    const mode = tryModes[i]!;
    const payload = buildReservationPayload(input, mode);
    console.log(`[insertReservation] attempt ${i + 1} (${mode}) payload:`, JSON.stringify(payload));

    const { data, error } = await client.from("reservations").insert(payload).select("*").single();

    if (!error) {
      return data as Reservation;
    }

    console.error("[insertReservation] Supabase error:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      mode,
    });

    if (mode === "full" && isLikelyMissingColumnError(error.message)) {
      console.warn(
        "[insertReservation] retrying with minimal columns (user_id, resource_id, phone_number only)"
      );
      continue;
    }

    throw new Error(error.message);
  }

  throw new Error("Reservation insert failed after retries");
}
