/** color-mix() needs Chromium 111+; older webviews get the fallback tokens. */
export function supportsColorMix(): boolean {
  return typeof CSS !== 'undefined' && CSS.supports('color', 'color-mix(in srgb, red, blue)');
}
