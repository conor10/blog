import { defineCollection, z } from 'astro:content';
import { file, glob } from 'astro/loaders';

const writing = defineCollection({
  loader: glob({
    pattern: '**/*.{md,mdx}',
    base: './src/content/writing',
    // Slug resolution, in order of precedence:
    //   1. `slug` in the post's frontmatter (explicit override)
    //   2. folder name with the YYYY-MM-DD- prefix stripped and /index removed
    // Examples:
    //   "2026-04-22-foo/index.md" -> "foo"
    //   "foo/index.md"            -> "foo"
    //   "foo.md"                  -> "foo"
    //   frontmatter `slug: bar`   -> "bar"
    generateId: ({ entry, data }) => {
      if (typeof data.slug === 'string' && data.slug.length > 0) {
        return data.slug;
      }
      return entry
        .replace(/\.(md|mdx)$/, '')          // drop extension
        .replace(/\/index$/, '')             // drop trailing /index
        .replace(/^\d{4}-\d{2}-\d{2}-/, ''); // strip leading YYYY-MM-DD- prefix
    },
  }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    description: z.string(),
    slug: z.string().optional(),
    ogImage: z.string().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

const archive = defineCollection({
  loader: file('./src/content/archive/posts.json'),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    description: z.string(),
    source: z.enum(['blogspot', 'quanttech', 'conorsvensson', 'newsletter']),
    originalUrl: z.string().url(),
    snapshotUrl: z.string().url(),
    featuredImage: z.object({
      src: z.string(),
      alt: z.string(),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    }).optional(),
    html: z.string(),
  }),
});

export const collections = { writing, archive };
