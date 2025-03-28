import { compile } from '@mdx-js/mdx';
import * as babel from '@babel/core';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import remarkFrontmatter from 'remark-frontmatter';
import remarkMdxFrontmatter from 'remark-mdx-frontmatter';

interface MDXProcessorOptions {
  content: string;
  filePath: string;
}

export class MDXProcessor {
  public static async process({ content, filePath }: MDXProcessorOptions): Promise<string> {
    try {
      const processedContent = content.replace(/<!--[\s\S]*?-->/g, '{/* $& */}');
      const compiledMDX = await compile(processedContent, {
        jsx: true,
        outputFormat: 'function-body',
        development: false,
        remarkPlugins: [remarkGfm, remarkFrontmatter, remarkMdxFrontmatter],
        rehypePlugins: [
          [rehypeHighlight, {
            ignoreMissing: true,
            plainText: ['txt', 'text'],
          }],
        ],
      });

      let codeStr = String(compiledMDX);
      codeStr = codeStr
        .replace(/\/\*@jsx[a-zA-Z]+\s+[a-zA-Z\s]+\*\//g, '')
        .replace(/"use strict";/, '')
        .replace(/return\s*{\s*frontmatter\s*,?\s*default:\s*MDXContent\s*};?\s*$/s, '')
        .trim();

      if (!codeStr.includes('return')) {
        codeStr += '\nreturn <></>;';
      }

      const presetReact = require('@babel/preset-react');

      const transformed = await babel.transformAsync(codeStr, {
        presets: [presetReact],
        plugins: [
          () => ({
            visitor: {
              ImportDeclaration(path: any) {
                if (path.node.source.value === 'react') {
                  path.remove();
                }
              },
            },
          }),
        ],
      });

      if (!transformed || !transformed.code) {
          throw new Error('Babel transformation failed to produce code');
      }

      const mdxCode = `
        ${transformed.code}
        return MDXContent({ components: {} });
      `;
      return mdxCode;
    } catch (error: any) {
      console.error('MDX Process Error:', error);
      return `console.error('MDX Error: ${error.message}');`;
    }
  }
}
