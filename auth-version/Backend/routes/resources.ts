import { Router, Request, Response } from 'express';
import { optionalAuth } from '../middleware/auth';
import { createNewResource, listAvailableResources } from '../services/resourceService';

const router = Router();

function parseOptionalNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

const AVAILABLE_STATUS_FILTER = 'available' as const;

router.get('/available', async (_req: Request, res: Response) => {
  try {
    const resources = await listAvailableResources();
    console.log('[GET /api/resources/available] status filter used: resources.status =', JSON.stringify(AVAILABLE_STATUS_FILTER));
    console.log('[GET /api/resources/available] total resources fetched:', resources.length);
    return res.status(200).json(resources);
  } catch (err) {
    console.error('[GET /api/resources/available] failed:', err);
    const message = err instanceof Error ? err.message : 'Failed to load available resources';
    return res.status(500).json({ error: message });
  }
});

router.post('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { title, resource_type, quantity, expires_at, lat, lng } = req.body ?? {};

    if (typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'title is required' });
    }

    let quantityVal: number | null = null;
    if (quantity !== undefined && quantity !== null && quantity !== '') {
      const q = Number(quantity);
      if (!Number.isFinite(q) || !Number.isInteger(q)) {
        return res.status(400).json({ error: 'quantity must be an integer' });
      }
      quantityVal = q;
    }

    let expiresAtVal: string | null = null;
    if (expires_at !== undefined && expires_at !== null && expires_at !== '') {
      if (typeof expires_at !== 'string') {
        return res.status(400).json({ error: 'expires_at must be an ISO date string' });
      }
      expiresAtVal = expires_at;
    }

    const resource = await createNewResource({
      title: title.trim(),
      resource_type: typeof resource_type === 'string' && resource_type.trim() ? resource_type.trim() : undefined,
      quantity: quantityVal,
      expires_at: expiresAtVal,
      lat: parseOptionalNumber(lat),
      lng: parseOptionalNumber(lng),
      provider_id: req.user?.id ?? null,
    });

    return res.status(201).json(resource);
  } catch (err) {
    console.error('[POST /api/resources] failed:', err);
    const message = err instanceof Error ? err.message : 'Failed to create resource';
    return res.status(500).json({ error: message });
  }
});

export default router;
