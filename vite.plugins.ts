import type { Plugin } from 'vite'

/**
 * Strips Vite-dev-only CSP tokens (`ws://localhost:*` / `http://localhost:*`,
 * needed for HMR) from the shipped HTML's Content-Security-Policy. Dev keeps
 * them; production builds shouldn't allow the renderer to reach local services.
 * Applied to every HTML entry (index/palette/widget) via transformIndexHtml.
 */
export function stripDevCsp(): Plugin {
  return {
    name: 'strip-dev-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(/ ws:\/\/localhost:\* http:\/\/localhost:\*/g, '')
    },
  }
}
