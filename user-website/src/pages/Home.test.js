import { render, screen, within } from '@testing-library/react';
import Home from './Home.js';
import {
  getActiveBanners,
  getActiveProducts,
  getAllCategories,
  getAvailableVouchers,
  getPublishedNews
} from '../services/dataService';

jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => jest.fn()
}));

jest.mock('../services/dataService', () => ({
  getActiveBanners: jest.fn().mockResolvedValue([]),
  getActiveProducts: jest.fn().mockResolvedValue([]),
  getAllCategories: jest.fn().mockResolvedValue([]),
  getAvailableVouchers: jest.fn().mockResolvedValue([]),
  getCustomerVoucherClaims: jest.fn().mockResolvedValue([]),
  getPublishedNews: jest.fn().mockResolvedValue([])
}));

jest.mock('../services/customerAuthService', () => ({
  getCustomerProfile: jest.fn().mockResolvedValue(null)
}));

beforeEach(() => {
  window.matchMedia = jest.fn().mockReturnValue({
    matches: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  });
});

test('shows the storefront and product placeholders while products load', () => {
  const pendingRequest = new Promise(() => {});
  getActiveBanners.mockReturnValue(pendingRequest);
  getActiveProducts.mockReturnValue(pendingRequest);
  getAllCategories.mockReturnValue(pendingRequest);
  getAvailableVouchers.mockReturnValue(pendingRequest);
  getPublishedNews.mockReturnValue(pendingRequest);

  render(<Home addToCart={jest.fn()} user={null} />);

  expect(screen.getByRole('heading', { name: 'Chọn điều ngon, gửi trọn yêu thương' })).toBeInTheDocument();
  expect(screen.getByRole('status', { name: 'Đang tải sản phẩm' })).toBeInTheDocument();
});

test('renders products without waiting for banners, categories, news, or vouchers', async () => {
  const pendingRequest = new Promise(() => {});
  getActiveBanners.mockReturnValue(pendingRequest);
  getActiveProducts.mockResolvedValue([{
    id: 'product-1',
    name: 'Sản phẩm tải nhanh',
    price: 10000,
    stock: 5,
    isActive: true
  }]);
  getAllCategories.mockReturnValue(pendingRequest);
  getAvailableVouchers.mockReturnValue(pendingRequest);
  getPublishedNews.mockReturnValue(pendingRequest);

  render(<Home addToCart={jest.fn()} user={null} />);

  expect(screen.getByRole('heading', { name: 'Chọn điều ngon, gửi trọn yêu thương' })).toBeInTheDocument();
  expect(await screen.findByText('Sản phẩm tải nhanh')).toBeInTheDocument();
});

test('shows up to ten newest products in each category below featured products', async () => {
  const products = Array.from({ length: 12 }, (_, index) => ({
    id: `product-${index + 1}`,
    name: `Sản phẩm ${index + 1}`,
    categoryId: 'category-1',
    createdAt: new Date(2026, 0, index + 1).toISOString(),
    price: 10000,
    stock: 5,
    isActive: true
  })).reverse();
  getActiveBanners.mockResolvedValue([]);
  getActiveProducts.mockResolvedValue(products);
  getAllCategories.mockResolvedValue([{ id: 'category-1', name: 'Đồ ăn vặt', isActive: true }]);
  getAvailableVouchers.mockResolvedValue([]);
  getPublishedNews.mockResolvedValue([]);

  render(<Home addToCart={jest.fn()} user={null} />);

  const categorySection = (await screen.findByRole('heading', { name: 'Đồ ăn vặt' })).closest('section');
  expect(categorySection).not.toBeNull();
  expect(within(categorySection).getAllByRole('article')).toHaveLength(10);
  expect(within(categorySection).getAllByText(/^Sản phẩm \d+$/)[0]).toHaveTextContent('Sản phẩm 12');
  expect(within(categorySection).queryByText('Sản phẩm 2', { exact: true })).toBeNull();
});
