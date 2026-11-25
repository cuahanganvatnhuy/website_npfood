import { useLayoutEffect, useRef, useState } from 'react';
import {
  escapeProductDescriptionText,
  sanitizeProductDescription
} from '../utils/productDescription.js';
import '../css/ProductDescriptionEditor.css';

const toolbarItems = [
  { command: 'bold', label: 'Đậm', symbol: 'B', className: 'is-bold' },
  { command: 'italic', label: 'Nghiêng', symbol: 'I', className: 'is-italic' },
  { command: 'underline', label: 'Gạch chân', symbol: 'U', className: 'is-underline' },
  { command: 'insertUnorderedList', label: 'Danh sách chấm', symbol: '•' },
  { command: 'insertOrderedList', label: 'Danh sách số', symbol: '1.' }
];

const ProductDescriptionEditor = ({ initialValue = '', onChange }) => {
  const editorRef = useRef(null);
  const [initialHtml] = useState(() => sanitizeProductDescription(initialValue));

  useLayoutEffect(() => {
    if (!editorRef.current) return;
    editorRef.current.innerHTML = initialHtml;
    editorRef.current.classList.toggle('has-content', Boolean(initialHtml));
  }, [initialHtml]);

  const syncDescription = () => {
    if (editorRef.current) {
      const hasText = Boolean(editorRef.current.textContent.trim());
      editorRef.current.classList.toggle('has-content', hasText);
      onChange(hasText ? sanitizeProductDescription(editorRef.current.innerHTML) : '');
    }
  };

  const applyFormatting = (command) => {
    editorRef.current?.focus();
    document.execCommand(command, false);
    syncDescription();
  };

  const handlePaste = (event) => {
    event.preventDefault();
    const clipboard = event.clipboardData;
    const pastedHtml = clipboard.getData('text/html');
    const pastedText = clipboard.getData('text/plain');
    const cleanContent = pastedHtml
      ? sanitizeProductDescription(pastedHtml)
      : escapeProductDescriptionText(pastedText);

    editorRef.current?.focus();
    document.execCommand('insertHTML', false, cleanContent);
    syncDescription();
  };

  return (
    <div className="product-description-editor">
      <div className="product-description-toolbar" role="toolbar" aria-label="Định dạng mô tả">
        {toolbarItems.map((item) => (
          <button
            key={item.command}
            type="button"
            className={item.className || ''}
            title={item.label}
            aria-label={item.label}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => applyFormatting(item.command)}
          >
            {item.symbol}
          </button>
        ))}
      </div>
      <div
        ref={editorRef}
        id="product-description"
        className="product-description-editable"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label="Mô tả sản phẩm"
        aria-multiline="true"
        data-placeholder="Nhập mô tả sản phẩm..."
        onInput={syncDescription}
        onPaste={handlePaste}
      />
      <p className="product-description-editor-help">
        Có thể định dạng nội dung hoặc dán trực tiếp từ Word.
      </p>
    </div>
  );
};

export default ProductDescriptionEditor;
