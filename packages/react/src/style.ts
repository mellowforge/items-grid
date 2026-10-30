import type { StyleDeclarations } from '@quietfoundry/items-grid-core';
import type { CSSProperties } from 'react';

/** Converts the core's kebab-case declarations into a React `style` object. */
export function toReactStyle(declarations: StyleDeclarations): CSSProperties {
  const style: Record<string, string> = {};
  for (const [property, value] of Object.entries(declarations)) {
    style[property.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())] = value;
  }
  return style as CSSProperties;
}
