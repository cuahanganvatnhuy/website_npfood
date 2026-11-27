import { fireEvent, render, screen } from '@testing-library/react';
import Login from './Login.js';

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn()
}));

jest.mock('../context/AuthContext.js', () => ({
  useAuth: () => ({ user: null, isAdminUser: false })
}));

jest.mock('../services/authService.js', () => ({
  isAdmin: jest.fn(),
  loginWithEmail: jest.fn(),
  loginWithGoogle: jest.fn(),
  logout: jest.fn()
}));

test('shows and hides the password when the visibility button is toggled', () => {
  render(<Login />);

  const passwordInput = screen.getByLabelText(/Mật khẩu/);
  expect(passwordInput.type).toBe('password');

  fireEvent.click(screen.getByRole('button', { name: 'Hiện mật khẩu' }));
  expect(passwordInput.type).toBe('text');

  fireEvent.click(screen.getByRole('button', { name: 'Ẩn mật khẩu' }));
  expect(passwordInput.type).toBe('password');
});
