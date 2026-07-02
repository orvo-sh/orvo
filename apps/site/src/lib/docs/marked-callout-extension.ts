import type { TokenizerAndRendererExtension } from 'marked';

const infoIcon = `
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
    <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 4a1.25 1.25 0 1 1 0 2.5A1.25 1.25 0 0 1 12 6Zm2 12h-4v-1.5h1V11h-1V9.5h3.5v7H14V18Z" />
  </svg>
`;

const createMarkedCalloutExtension = () =>
  ({
    name: 'callout',
    level: 'block',
    start(src) {
      return src.indexOf(':::');
    },
    tokenizer(src) {
      const match = /^:::(\w+)\n([\s\S]*?)\n:::/.exec(src);

      if (match) {
        return {
          type: 'callout',
          raw: match[0],
          kind: ['info'].includes(match[1]) ? match[1] : 'info',
          content: this.lexer.blockTokens(match[2])
        };
      }
    },
    renderer(token) {
      return `<div class="callout callout-${token.kind}">
        <span class="callout-icon">${infoIcon}</span>
        <div class="callout-content">${this.parser.parse(token.content)}</div>
      </div>`;
    }
  }) satisfies TokenizerAndRendererExtension;

export { createMarkedCalloutExtension };
