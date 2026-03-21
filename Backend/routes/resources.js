"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const resourceService_1 = require("../services/resourceService");
const router = (0, express_1.Router)();
function parseOptionalNumber(value) {
    if (value === undefined || value === null || value === '')
        return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}
const AVAILABLE_STATUS_FILTER = 'available';
router.get('/available', async (_req, res) => {
    try {
        const resources = await (0, resourceService_1.listAvailableResources)();
        console.log('[GET /api/resources/available] status filter used: resources.status =', JSON.stringify(AVAILABLE_STATUS_FILTER));
        console.log('[GET /api/resources/available] total resources fetched:', resources.length);
        return res.status(200).json(resources);
    }
    catch (err) {
        console.error('[GET /api/resources/available] failed:', err);
        const message = err instanceof Error ? err.message : 'Failed to load available resources';
        return res.status(500).json({ error: message });
    }
});
router.post('/', async (req, res) => {
    try {
        const { title, resource_type, quantity, expires_at, lat, lng } = req.body ?? {};
        if (typeof title !== 'string' || !title.trim()) {
            return res.status(400).json({ error: 'title is required' });
        }
        let quantityVal = null;
        if (quantity !== undefined && quantity !== null && quantity !== '') {
            const q = Number(quantity);
            if (!Number.isFinite(q) || !Number.isInteger(q)) {
                return res.status(400).json({ error: 'quantity must be an integer' });
            }
            quantityVal = q;
        }
        let expiresAtVal = null;
        if (expires_at !== undefined && expires_at !== null && expires_at !== '') {
            if (typeof expires_at !== 'string') {
                return res.status(400).json({ error: 'expires_at must be an ISO date string' });
            }
            expiresAtVal = expires_at;
        }
        const resource = await (0, resourceService_1.createNewResource)({
            title: title.trim(),
            resource_type: typeof resource_type === 'string' && resource_type.trim() ? resource_type.trim() : undefined,
            quantity: quantityVal,
            expires_at: expiresAtVal,
            lat: parseOptionalNumber(lat),
            lng: parseOptionalNumber(lng),
        });
        return res.status(201).json(resource);
    }
    catch (err) {
        console.error('[POST /api/resources] failed:', err);
        const message = err instanceof Error ? err.message : 'Failed to create resource';
        return res.status(500).json({ error: message });
    }
});
exports.default = router;
