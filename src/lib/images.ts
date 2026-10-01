/**
 * Resolve an image path to its local copy under public/images.
 * (Archived site: images were exported out of Supabase Storage.)
 */
export function getPublicImageUrl(filename: string): string {
  return `/images/${filename.replace(/^\/+/, "")}`;
}
