// The look plan, in one place. Six values and one accent hue; the lighting makes every
// shade the game needs, so no other colour appears in the code. The same six names are
// the CSS custom properties in index.html.
export const PALETTE = {
  canvas: '#424a5c',
  surface: '#58647a',
  hairline: '#74829c',
  ink: '#ffffff',
  muted: '#d0d6e0',
  accent: '#f5b44c',
};

export function shade(name) {
  return PALETTE[name];
}
