import {
  getProductDescriptionText,
  sanitizeProductDescription
} from './productDescription';

test('preserves rich product description formatting without unsafe markup', () => {
  const html = sanitizeProductDescription(
    '<h2>Thành phần</h2><ul><li><strong>Sữa</strong></li></ul>' +
      '<img src=x onerror="alert(1)"><script>alert(1)</script>'
  );

  expect(html).toContain('<h2>Thành phần</h2>');
  expect(html).toContain('<ul><li><strong>Sữa</strong></li></ul>');
  expect(html).not.toContain('<img');
  expect(html).not.toContain('<script>');
  expect(html).not.toContain('onerror');
});

test('extracts readable text from HTML descriptions for product search', () => {
  expect(getProductDescriptionText('<p><strong>Bột</strong> ngon</p>')).toBe('Bột ngon');
});
