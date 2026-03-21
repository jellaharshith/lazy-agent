import path from 'path';
import { config } from 'dotenv';

// Repo root `.env` (one level above `Backend/`), regardless of cwd
const envPath = path.resolve(__dirname, '..', '.env');
config({ path: envPath });
