import * as worldbook from './worldbook.js';
export const name = 'dsh-storydeck';
export function apply(ctx) {
  ctx.plugin(worldbook);
}
