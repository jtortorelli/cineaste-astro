import { getCollection } from "astro:content";

export async function getReviewSlugs(): Promise<Set<string>> {
  const reviews = await getCollection("reviews");
  return new Set(reviews.map((review) => review.id.replace(/\.md$/, "")));
}

export async function hasWrittenReview(slug: string): Promise<boolean> {
  const slugs = await getReviewSlugs();
  return slugs.has(slug);
}
