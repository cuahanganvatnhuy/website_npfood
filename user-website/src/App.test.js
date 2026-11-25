import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('./services/dataService', () => ({
  getActiveBanners: jest.fn().mockResolvedValue([]),
  getActiveMarketplaceChannels: jest.fn().mockResolvedValue([]),
  getActiveProducts: jest.fn().mockResolvedValue([]),
  getAvailableVouchers: jest.fn().mockResolvedValue([]),
  getAllCategories: jest.fn().mockResolvedValue([]),
  getPublishedNews: jest.fn().mockResolvedValue([]),
  getContactInfo: jest.fn().mockResolvedValue(null)
}));

jest.mock('./services/customerAuthService', () => ({
  subscribeToCustomerAuth: jest.fn(() => () => {}),
  registerCustomerAccount: jest.fn(),
  signInWithGoogle: jest.fn(),
  signInWithFacebook: jest.fn(),
  sendCustomerPhoneCode: jest.fn(),
  createCustomerPhoneVerifier: jest.fn(() => ({ clear: jest.fn() })),
  confirmCustomerPhoneCode: jest.fn(),
  signInCustomer: jest.fn(),
  signOutCustomer: jest.fn(),
  getCustomerProfile: jest.fn().mockResolvedValue(null)
}));

test('renders the NP Food storefront', async () => {
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Chọn điều ngon, gửi trọn yêu thương' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /giỏ hàng/i })).toBeInTheDocument();
});
