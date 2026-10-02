// Static assets (logos, icons) are served from the Supabase Storage bucket
// `portal-assets`. Paths mirror the public/ folder, e.g. "assets/xlsx.png".
// Re-upload with scripts/upload-assets.sh after changing files in public/.
export const ASSETS_BASE_URL = (
  process.env.NEXT_PUBLIC_ASSETS_URL ||
  'https://awcoxytlmjiyfmpzinam.supabase.co/storage/v1/object/public/portal-assets'
).replace(/\/$/, '');

export function assetUrl(path: string): string {
  return `${ASSETS_BASE_URL}/${path.replace(/^\//, '')}`;
}
