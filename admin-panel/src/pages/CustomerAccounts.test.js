import { render, screen } from '@testing-library/react';
import CustomerAccounts from './CustomerAccounts.js';
import { getAllOrders } from '../services/orderService.js';
import { getAllCustomers, updateCustomer } from '../services/customerService.js';
import { getLoyaltySettings } from '../services/promotionService.js';

jest.mock('../services/orderService.js', () => ({
  getAllOrders: jest.fn()
}));

jest.mock('../services/customerService.js', () => ({
  getAllCustomers: jest.fn(),
  updateCustomer: jest.fn()
}));

jest.mock('../services/promotionService.js', () => ({
  getLoyaltySettings: jest.fn()
}));

beforeEach(() => {
  jest.clearAllMocks();
  updateCustomer.mockResolvedValue(undefined);
  getLoyaltySettings.mockResolvedValue({
    amountPerPoint: 1000,
    pointsPerAmount: 1,
    tiers: [
      { name: 'Đồng', minPoints: 0 },
      { name: 'Bạc', minPoints: 100 },
      { name: 'Vàng', minPoints: 500 },
      { name: 'Kim cương', minPoints: 1000 }
    ]
  });
  getAllCustomers.mockResolvedValue([{
    id: 'customer-1',
    uid: 'customer-1',
    name: 'Ngân Hoàng',
    email: 'buyer@example.com',
    lifetimeSpend: 0,
    points: 60
  }]);
  getAllOrders.mockResolvedValue([
    { id: 'delivered-1', customerUid: 'old-google-uid', customer: { email: 'buyer@example.com' }, status: 'delivered', totalAmount: 12300 },
    { id: 'delivered-2', customerUid: 'old-google-uid', customer: { email: 'buyer@example.com' }, status: 'delivered', totalAmount: 22700 },
    { id: 'delivered-3', customerUid: 'old-google-uid', customer: { email: 'buyer@example.com' }, status: 'delivered', totalAmount: 25000 },
    { id: 'pending', customerUid: 'old-google-uid', customer: { email: 'buyer@example.com' }, status: 'pending', totalAmount: 99999 }
  ]);
});

test('shows delivered-order spend and the customer points saved in Firebase', async () => {
  render(<CustomerAccounts />);

  expect(await screen.findByText('60.000 ₫')).toBeInTheDocument();
  expect(screen.getByText('60 điểm')).toBeInTheDocument();
  expect(updateCustomer).toHaveBeenCalledWith('customer-1', expect.objectContaining({
    lifetimeSpend: 60000,
    points: 60
  }));
});
