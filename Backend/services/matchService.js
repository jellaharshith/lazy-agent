"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateDistanceKm = calculateDistanceKm;
exports.scoreResource = scoreResource;
exports.findBestResourceForNeed = findBestResourceForNeed;
exports.createMatchForNeed = createMatchForNeed;
const matches_1 = require("../db/matches");
const resources_1 = require("../db/resources");
const EARTH_RADIUS_KM = 6371;
function toRadians(deg) {
    return (deg * Math.PI) / 180;
}
function urgencyWeight(urgency) {
    const u = urgency.toLowerCase();
    if (u === 'critical')
        return 1;
    if (u === 'high')
        return 0.85;
    if (u === 'medium')
        return 0.65;
    return 0.45;
}
/** Higher when closer to the need (inverse distance: near → ~1, far → ~0). */
function inverseDistanceScore(distanceKm) {
    if (!Number.isFinite(distanceKm))
        return 0;
    if (distanceKm <= 1)
        return 1;
    if (distanceKm >= 30)
        return 0;
    return 1 - (distanceKm - 1) / 29;
}
function expiryPriority(expiresAt) {
    if (!expiresAt)
        return 0.6;
    const ms = new Date(expiresAt).getTime() - Date.now();
    if (!Number.isFinite(ms) || ms <= 0)
        return 0;
    const hours = ms / (1000 * 60 * 60);
    if (hours <= 6)
        return 1;
    if (hours <= 24)
        return 0.85;
    if (hours <= 72)
        return 0.65;
    return 0.5;
}
/** Haversine great-circle distance in kilometers. */
function calculateDistanceKm(lat1, lng1, lat2, lng2) {
    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((EARTH_RADIUS_KM * c).toFixed(2));
}
/**
 * Weighted score: urgency + inverse distance (closer is better) + expiry (sooner expiry = higher priority).
 */
function scoreResource(urgency, distanceKm, expiresAt) {
    const s = urgencyWeight(urgency) * 0.45 +
        inverseDistanceScore(distanceKm) * 0.4 +
        expiryPriority(expiresAt) * 0.15;
    return Number(s.toFixed(4));
}
/** Picks the resource with highest score (distance computed per resource). */
function findBestResourceForNeed(need, resources) {
    if (need.lat == null || need.lng == null)
        return null;
    let best = null;
    for (const r of resources) {
        if (r.lat == null || r.lng == null)
            continue;
        if (r.status !== 'available')
            continue;
        if (r.quantity != null && r.quantity <= 0)
            continue;
        const distanceKm = calculateDistanceKm(need.lat, need.lng, r.lat, r.lng);
        const score = scoreResource(need.urgency, distanceKm, r.expires_at);
        if (!best || score > best.score) {
            best = { resource: r, score, distanceKm };
        }
    }
    return best;
}
/** Fetches available rows from DB, scores by distance + urgency + expiry, inserts a suggested match. */
async function createMatchForNeed(need) {
    const resources = await (0, resources_1.getAvailableResources)();
    const best = findBestResourceForNeed(need, resources);
    if (!best)
        return null;
    return (0, matches_1.createMatch)({
        need_id: need.id,
        resource_id: best.resource.id,
        score: best.score,
        distance_km: best.distanceKm,
        status: 'suggested',
    });
}
