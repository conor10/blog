import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

export default defineConfig({
  site: 'https://conorsvensson.com',
  integrations: [mdx(), sitemap()],
  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex],
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
      // Emit both theme colours as CSS variables (--shiki-light and
      // --shiki-dark) instead of baking the light theme into a bare
      // inline `color:`. Our CSS switches between them via [data-theme].
      defaultColor: false,
    },
  },
});
