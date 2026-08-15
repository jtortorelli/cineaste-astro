import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const loose = z.object({}).passthrough();

export const collections = {
  films: defineCollection({
    loader: glob({ pattern: "**/*.md", base: "./src/content/films" }),
    schema: loose,
  }),
  people: defineCollection({
    loader: glob({ pattern: "**/*.md", base: "./src/content/people" }),
    schema: loose,
  }),
  reviews: defineCollection({
    loader: glob({ pattern: "**/*.md", base: "./src/content/reviews" }),
    schema: loose,
  }),
};
