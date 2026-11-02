// Run once with the environment of the deployment. No customer records are created.
import { createClient } from '@supabase/supabase-js';
const bucket = 'tiktok-profile-links';
const admin = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const current = await admin.storage.getBucket(bucket);
if (current.data) {
  if (current.data.public) throw Error('Profile bucket must be private; refusing to proceed.');
  console.log('TikTok profile storage: private bucket already exists.');
} else {
  if (!['400', '404'].includes(String(current.error?.statusCode)) || !/not found/i.test(current.error?.message ?? '')) throw Error('Could not verify profile storage.');
  const created = await admin.storage.createBucket(bucket, { public: false, fileSizeLimit: 8192, allowedMimeTypes: ['application/json'] });
  if (created.error) throw Error('Could not create private profile storage: ' + created.error.message);
  console.log('TikTok profile storage: private bucket created.');
}
