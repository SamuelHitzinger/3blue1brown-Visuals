import { readFile } from 'node:fs/promises';

export const PLAYER_RESOURCE = 'ui://aha-video/player-v2.html';

export async function playerResource() {
  const template = await readFile(new URL('../dist/player.html', import.meta.url), 'utf8');
  return {
    uri: PLAYER_RESOURCE, mimeType: 'text/html;profile=mcp-app',
    text: template,
    _meta: {
      ui: { prefersBorder: false, csp: { connectDomains: [], resourceDomains: [], frameDomains: [] } },
      'openai/widgetCSP': { connect_domains: [], resource_domains: [], frame_domains: [] },
      'openai/widgetDescription': 'The original Aha interactive lesson, with audio, captions, sliders, seeking and follow-up scenes.',
      'openai/ui': { availableDisplayModes: ['inline', 'fullscreen'] },
    },
  };
}
