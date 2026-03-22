import { Router, Request, Response } from "express";
import { createSupabaseWithAccessToken, getSupabaseAdmin } from "../config/supabase";
import { getResourceById } from "../db/resources";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { insertReservation } from "../services/reservationService";
import {
  buildSeekerSpokenMessage,
  generateVoiceMessage,
  sendProviderReservationAlertCall,
  sendSeekerReservationCall,
  type ReservationVoiceCallInput,
} from "../services/voiceCallService";
import { uploadBufferToS3 } from "../services/storageService";
import { isS3Configured } from "../config/s3";

const router = Router();

function formatPickupTime(expiresAt: string | null): string | undefined {
  if (!expiresAt) return undefined;
  const d = new Date(expiresAt);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

type ProviderPhoneSource = "provider_profile" | "provider_alert_env" | "twilio_test_to" | "none";

function maskPhoneHint(value: string | null): string {
  if (!value) return "(none)";
  const d = value.replace(/\D/g, "");
  if (d.length < 4) return "(hidden)";
  return `••••${d.slice(-4)}`;
}

/**
 * `resources` rows have no phone field in this codebase; provider SMS/voice uses `profiles.phone_number`.
 * Order: profile → PROVIDER_ALERT_PHONE → TWILIO_TEST_TO.
 */
async function loadProviderVoiceContact(providerId: string | null | undefined): Promise<{
  phone: string | null;
  name: string | null;
  source: ProviderPhoneSource;
}> {
  const pid = typeof providerId === "string" ? providerId.trim() : "";
  let name: string | null = null;
  let phone: string | null = null;
  let source: ProviderPhoneSource = "none";

  const admin = getSupabaseAdmin();
  if (admin && pid) {
    type ProfileRow = { full_name?: string | null; phone_number?: string | null };
    let row: ProfileRow | null = null;
    const r1 = await admin.from("profiles").select("full_name, phone_number").eq("id", pid).maybeSingle();
    if (r1.error) {
      const msg = r1.error.message || "";
      if (/phone_number|column/i.test(msg)) {
        const r2 = await admin.from("profiles").select("full_name").eq("id", pid).maybeSingle();
        if (!r2.error) row = r2.data as ProfileRow;
      }
    } else {
      row = r1.data as ProfileRow | null;
    }
    if (row) {
      name = typeof row.full_name === "string" && row.full_name.trim() ? row.full_name.trim() : null;
      const pn =
        typeof row.phone_number === "string" && row.phone_number.trim() ? row.phone_number.trim() : null;
      if (pn) {
        phone = pn;
        source = "provider_profile";
      }
    }
  }

  const alertEnv = process.env.PROVIDER_ALERT_PHONE?.trim();
  if (!phone && alertEnv) {
    phone = alertEnv;
    source = "provider_alert_env";
  }

  const testTo = process.env.TWILIO_TEST_TO?.trim();
  if (!phone && testTo) {
    phone = testTo;
    source = "twilio_test_to";
  }

  console.log(
    `[reservations] provider alert phone source=${source} to=${maskPhoneHint(phone)} provider_id=${pid || "(none)"} admin=${admin ? "yes" : "no"}`
  );

  return { phone, name, source };
}

router.post("/", requireAuth, requireRole(["seeker"]), async (req: Request, res: Response) => {
  try {
    const token = req.authToken;
    if (!token || !req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { resource_id, phone_number, customer_name } = req.body ?? {};
    if (typeof resource_id !== "string" || !resource_id.trim()) {
      return res.status(400).json({ error: "resource_id is required" });
    }

    const phone =
      typeof phone_number === "string" && phone_number.trim() ? phone_number.trim() : null;
    if (!phone) {
      return res.status(400).json({ error: "phone_number is required" });
    }

    const resource = await getResourceById(resource_id.trim());
    if (!resource) {
      return res.status(404).json({ error: "Resource not found" });
    }

    const db = createSupabaseWithAccessToken(token);
    let reservation = await insertReservation(db, {
      user_id: req.user.id,
      resource_id: resource.id,
      phone_number: phone,
      customer_name: typeof customer_name === "string" ? customer_name : undefined,
      status: "reserved",
    });

    const pickupTime = formatPickupTime(resource.expires_at);
    const discounted =
      resource.discounted_price != null && Number.isFinite(Number(resource.discounted_price))
        ? Number(resource.discounted_price)
        : undefined;

    const { phone: providerPhone, name: providerName } = await loadProviderVoiceContact(
      resource.provider_id
    );

    const baseSeeker: ReservationVoiceCallInput = {
      toNumber: phone,
      customerName: typeof customer_name === "string" ? customer_name : undefined,
      providerName: providerName ?? undefined,
      resourceTitle: resource.title,
      discountedPrice: discounted,
      pickupTime,
      reservationId: reservation.id,
    };

    const seekerCall = await sendSeekerReservationCall(baseSeeker);

    const baseProvider: ReservationVoiceCallInput = {
      ...baseSeeker,
      toNumber: providerPhone ?? "",
      providerName: providerName ?? undefined,
      customerName: typeof customer_name === "string" ? customer_name : undefined,
    };
    const providerCall = await sendProviderReservationAlertCall(baseProvider);

    const confirmationText = buildSeekerSpokenMessage(baseSeeker);
    type StoragePayload =
      | { attempted: true; success: true; provider: "aws-s3"; key: string; url: string }
      | { attempted: true; success: false; provider: "aws-s3"; message: string };

    let storage: StoragePayload;
    if (!isS3Configured()) {
      storage = {
        attempted: true,
        success: false,
        provider: "aws-s3",
        message: "S3 upload unavailable",
      };
    } else {
      const tts = await generateVoiceMessage(confirmationText);
      const mp3Buf =
        tts?.audioBase64 && tts.audioBase64.length > 0
          ? Buffer.from(tts.audioBase64, "base64")
          : null;

      const upload = mp3Buf
        ? await uploadBufferToS3({
            buffer: mp3Buf,
            key: `reservations/${reservation.id}/confirmation.mp3`,
            contentType: "audio/mpeg",
          })
        : await uploadBufferToS3({
            buffer: Buffer.from(confirmationText, "utf8"),
            key: `reservations/${reservation.id}/confirmation.txt`,
            contentType: "text/plain; charset=utf-8",
          });

      if (upload.success) {
        storage = {
          attempted: true,
          success: true,
          provider: "aws-s3",
          key: upload.key,
          url: upload.url,
        };
      } else {
        storage = {
          attempted: true,
          success: false,
          provider: "aws-s3",
          message: upload.message || "S3 upload unavailable",
        };
      }
    }

    const admin = getSupabaseAdmin();
    if (admin && providerCall.success) {
      const { error: updErr } = await admin
        .from("reservations")
        .update({ status: "provider_notified" })
        .eq("id", reservation.id);
      if (!updErr) {
        reservation = { ...reservation, status: "provider_notified" };
      } else {
        console.warn("[POST /api/reservations] could not set provider_notified:", updErr.message);
      }
    }

    return res.status(201).json({
      success: true,
      reservation,
      storage,
      voiceCalls: {
        seeker: {
          attempted: seekerCall.attempted,
          success: seekerCall.success,
          provider: seekerCall.provider,
          message: seekerCall.message,
          ...(seekerCall.simulated != null ? { simulated: seekerCall.simulated } : {}),
        },
        provider: {
          attempted: providerCall.attempted,
          success: providerCall.success,
          provider: providerCall.provider,
          message: providerCall.message,
          ...(providerCall.simulated != null ? { simulated: providerCall.simulated } : {}),
        },
      },
    });
  } catch (err) {
    console.error("[POST /api/reservations] failed:", err);
    const message = err instanceof Error ? err.message : "Reservation failed";
    return res.status(500).json({ error: message });
  }
});

export default router;
