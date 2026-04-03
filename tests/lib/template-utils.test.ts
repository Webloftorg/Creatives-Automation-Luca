import { describe, it, expect } from 'vitest';
import {
  replacePlaceholders,
  extractPlaceholders,
  extractCssVariables,
  placeholdersToDynamicFields,
} from '@/lib/template-utils';

describe('replacePlaceholders', () => {
  it('should replace all {{placeholders}} with values', () => {
    const html = '<h1>{{headline}}</h1><p>{{price}}</p>';
    const values = { headline: 'MONATLICH KÜNDBAR', price: '39,90€' };
    const result = replacePlaceholders(html, values);
    expect(result).toBe('<h1>MONATLICH KÜNDBAR</h1><p>39,90€</p>');
  });

  it('should leave unreplaced placeholders as empty string', () => {
    const html = '<h1>{{headline}}</h1><p>{{missing}}</p>';
    const result = replacePlaceholders(html, { headline: 'Test' });
    expect(result).toBe('<h1>Test</h1><p></p>');
  });

  it('should handle multiple occurrences of the same placeholder', () => {
    const html = '{{name}} loves {{name}}';
    const result = replacePlaceholders(html, { name: 'Gym' });
    expect(result).toBe('Gym loves Gym');
  });
});

describe('extractPlaceholders', () => {
  it('should extract all unique placeholder keys from HTML', () => {
    const html = '{{headline}} {{price}} {{headline}} {{location}}';
    const keys = extractPlaceholders(html);
    expect(keys).toEqual(['headline', 'price', 'location']);
  });

  it('should return empty array for no placeholders', () => {
    expect(extractPlaceholders('<h1>Hello</h1>')).toEqual([]);
  });
});

describe('extractCssVariables', () => {
  it('should extract CSS custom properties from :root', () => {
    const html = `<style>:root {
      --bg-blur: 6px;
      --bg-brightness: 0.4;
      --headline-size: 72px;
    }</style>`;
    const vars = extractCssVariables(html);
    expect(vars).toEqual({
      '--bg-blur': '6px',
      '--bg-brightness': '0.4',
      '--headline-size': '72px',
    });
  });

  it('should return empty object if no :root block', () => {
    expect(extractCssVariables('<div>hello</div>')).toEqual({});
  });
});

describe('placeholdersToDynamicFields', () => {
  it('should convert placeholder keys to DynamicField array', () => {
    const keys = ['headline', 'price', 'backgroundImage', 'primaryColor'];
    const fields = placeholdersToDynamicFields(keys);
    expect(fields).toEqual([
      { key: 'headline', label: 'Headline', type: 'text', required: true },
      { key: 'price', label: 'Price', type: 'text', required: true },
      { key: 'backgroundImage', label: 'Background Image', type: 'image', required: true },
      { key: 'primaryColor', label: 'Primary Color', type: 'color', required: true },
    ]);
  });
});
