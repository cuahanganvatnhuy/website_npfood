import {
  escapeProductDescriptionText,
  getProductDescriptionText,
  sanitizeProductDescription
} from './productDescription';

test('preserves supported formatting while removing unsafe HTML and attributes', () => {
  const html = sanitizeProductDescription(
    '<p style="color: rgb(63, 116, 18); position:fixed" onclick="alert(1)">' +
      '<strong>Đậm</strong> <em>nghiêng</em> <a href="javascript:alert(1)">liên kết</a>' +
      '<script>alert(1)</script></p>'
  );

  expect(html).toContain('<strong>Đậm</strong>');
  expect(html).toContain('<em>nghiêng</em>');
  expect(html).toContain('color:rgb(63, 116, 18)');
  expect(html).not.toContain('onclick');
  expect(html).not.toContain('position');
  expect(html).not.toContain('javascript:');
  expect(html).not.toContain('<script>');
});

test('converts formatted descriptions to searchable plain text', () => {
  expect(getProductDescriptionText('<p><strong>Bột</strong> ngon</p><ul><li>500g</li></ul>'))
    .toContain('Bột ngon');
  expect(getProductDescriptionText('<p><strong>Bột</strong> ngon</p><ul><li>500g</li></ul>'))
    .toContain('500g');
});

test('escapes plain text before inserting it into the rich text editor', () => {
  expect(escapeProductDescriptionText('<b>mô tả</b>\nDòng 2'))
    .toBe('&lt;b&gt;mô tả&lt;/b&gt;<br>Dòng 2');
});
