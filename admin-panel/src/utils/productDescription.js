const allowedTags = new Set([
  'A', 'B', 'BLOCKQUOTE', 'BR', 'DIV', 'EM', 'FONT', 'H1', 'H2', 'H3', 'I',
  'LI', 'OL', 'P', 'S', 'SPAN', 'STRONG', 'TABLE', 'TBODY', 'TD', 'TFOOT',
  'TH', 'THEAD', 'TR', 'U', 'UL'
]);

const blockedTags = new Set(['IFRAME', 'OBJECT', 'SCRIPT', 'STYLE', 'SVG', 'VIDEO', 'AUDIO']);

const sanitizeColor = (value) => {
  const color = String(value || '').trim();
  return /^(#[\da-f]{3,8}|(?:rgb|rgba|hsl|hsla)\([\d.,%\s]+\)|[a-z]{3,20})$/i.test(color)
    ? color
    : '';
};

const sanitizeStyles = (element) => {
  const styles = [];
  const color = sanitizeColor(element.style.color || element.getAttribute('color'));
  const backgroundColor = sanitizeColor(element.style.backgroundColor);
  const textAlign = ['left', 'center', 'right', 'justify'].includes(element.style.textAlign)
    ? element.style.textAlign
    : '';
  const fontWeight = /^(normal|bold|[5-9]00)$/.test(element.style.fontWeight)
    ? element.style.fontWeight
    : '';
  const fontStyle = ['normal', 'italic'].includes(element.style.fontStyle)
    ? element.style.fontStyle
    : '';
  const textDecoration = ['underline', 'line-through'].includes(element.style.textDecorationLine)
    ? element.style.textDecorationLine
    : '';
  const fontSize = element.style.fontSize.match(/^(\d+(?:\.\d+)?)(px|pt)$/i);
  if (color) styles.push(`color:${color}`);
  if (backgroundColor) styles.push(`background-color:${backgroundColor}`);
  if (textAlign) styles.push(`text-align:${textAlign}`);
  if (fontWeight) styles.push(`font-weight:${fontWeight}`);
  if (fontStyle) styles.push(`font-style:${fontStyle}`);
  if (textDecoration) styles.push(`text-decoration:${textDecoration}`);
  if (fontSize) {
    const size = Number(fontSize[1]) * (fontSize[2].toLowerCase() === 'pt' ? 4 / 3 : 1);
    if (size >= 10 && size <= 36) styles.push(`font-size:${size}px`);
  }
  return styles.join(';');
};

const sanitizeNode = (node, document) => {
  if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent || '');
  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  const tagName = node.tagName.toUpperCase();
  if (blockedTags.has(tagName)) return null;

  const children = Array.from(node.childNodes)
    .map((child) => sanitizeNode(child, document))
    .filter(Boolean);

  if (!allowedTags.has(tagName)) {
    const fragment = document.createDocumentFragment();
    children.forEach((child) => fragment.appendChild(child));
    return fragment;
  }

  const safeTagName = tagName === 'FONT' ? 'SPAN' : tagName;
  const cleanElement = document.createElement(safeTagName.toLowerCase());
  children.forEach((child) => cleanElement.appendChild(child));

  if (tagName === 'A') {
    const href = (node.getAttribute('href') || '').trim();
    if (/^(https?:\/\/|mailto:|\/|#)/i.test(href)) {
      cleanElement.setAttribute('href', href);
      cleanElement.setAttribute('rel', 'noopener noreferrer');
    }
  }

  const safeStyle = sanitizeStyles(node);
  if (safeStyle) cleanElement.setAttribute('style', safeStyle);
  return cleanElement;
};

export const sanitizeProductDescription = (value) => {
  if (!value) return '';
  const parser = new DOMParser();
  const parsed = parser.parseFromString(String(value), 'text/html');
  const cleanDocument = document.implementation.createHTMLDocument('');
  Array.from(parsed.body.childNodes)
    .map((node) => sanitizeNode(node, cleanDocument))
    .filter(Boolean)
    .forEach((node) => cleanDocument.body.appendChild(node));
  return cleanDocument.body.innerHTML;
};

export const getProductDescriptionText = (value) => {
  if (!value) return '';
  const parser = new DOMParser();
  return parser.parseFromString(String(value), 'text/html').body.textContent || '';
};

export const escapeProductDescriptionText = (value) => (
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\n/g, '<br>')
);
