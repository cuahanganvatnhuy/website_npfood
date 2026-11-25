import { useRef } from 'react';

const getVndDigits = (value) => String(value ?? '')
    .replace(/\D/g, '')
    .replace(/^0+(?=\d)/, '');

export const formatVndInput = (value) => {
  const digits = getVndDigits(value);
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

const getCursorPosition = (formattedValue, digitCount) => {
  if (digitCount <= 0) return 0;
  let digitsSeen = 0;
  for (let index = 0; index < formattedValue.length; index += 1) {
    if (/\d/.test(formattedValue[index])) digitsSeen += 1;
    if (digitsSeen === digitCount) return index + 1;
  }
  return formattedValue.length;
};

const CurrencyInput = ({ value = '', onValueChange, ...inputProps }) => {
  const inputRef = useRef(null);
  const formattedValue = formatVndInput(value);

  const handleChange = (event) => {
    const input = event.currentTarget;
    const digitsBeforeCursor = input.value
      .slice(0, input.selectionStart ?? input.value.length)
      .replace(/\D/g, '')
      .length;
    const rawValue = getVndDigits(input.value);
    const nextDisplayValue = formatVndInput(rawValue);
    onValueChange(rawValue);

    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => {
        if (!inputRef.current) return;
        const position = getCursorPosition(nextDisplayValue, digitsBeforeCursor);
        inputRef.current.setSelectionRange(position, position);
      });
    }
  };

  return (
    <input
      {...inputProps}
      ref={inputRef}
      type="text"
      inputMode="numeric"
      value={formattedValue}
      onChange={handleChange}
    />
  );
};

export default CurrencyInput;
