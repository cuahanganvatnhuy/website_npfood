import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import CurrencyInput from './CurrencyInput.js';

test('formats VND with dots and returns unformatted digits', () => {
  const onValueChange = jest.fn();
  const ControlledInput = () => {
    const [value, setValue] = useState('');
    return (
      <CurrencyInput
        aria-label="Giá"
        value={value}
        onValueChange={(nextValue) => {
          onValueChange(nextValue);
          setValue(nextValue);
        }}
      />
    );
  };

  render(<ControlledInput />);
  const input = screen.getByRole('textbox', { name: 'Giá' });
  fireEvent.change(input, { target: { value: '13000' } });

  expect(input.value).toBe('13.000');
  expect(onValueChange).toHaveBeenLastCalledWith('13000');
});
