/**
 * Resolve an image path to its local copy under public/images.
 */
export function getPublicImageUrl(filename: string): string {
  return `/images/${filename.replace(/^\/+/, "")}`;
}
