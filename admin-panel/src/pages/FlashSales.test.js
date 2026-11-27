import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import FlashSales from './FlashSales.js';
import { getAllProducts } from '../services/productService.js';
import {
  deleteFlashSale,
  getAllFlashSales,
  publishFlashSale,
  saveFlashSaleDraft,
  setFlashSaleActive
} from '../services/flashSaleService.js';

jest.mock('../services/productService.js', () => ({
  getAllProducts: jest.fn()
}));

jest.mock('../services/flashSaleService.js', () => ({
  deleteFlashSale: jest.fn(),
  getAllFlashSales: jest.fn(),
  publishFlashSale: jest.fn(),
  saveFlashSaleDraft: jest.fn(),
  setFlashSaleActive: jest.fn()
}));

test('copies a campaign into a new editable draft with its selected products and prices', async () => {
  const startsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const endsAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  getAllProducts.mockResolvedValue([
    { id: 'product-1', name: 'Bánh snack', price: 100000, isActive: true }
  ]);
  getAllFlashSales.mockResolvedValue([{
    id: 'campaign-1',
    name: 'Flash Sale cuối tuần',
    startsAt,
    endsAt,
    status: 'published',
    isActive: true,
    products: { 'product-1': { salePrice: 75000 } }
  }]);
  saveFlashSaleDraft.mockResolvedValue('campaign-copy');
  publishFlashSale.mockResolvedValue(undefined);

  render(<FlashSales />);

  fireEvent.click(await screen.findByRole('button', {
    name: 'Sao chép chương trình Flash Sale cuối tuần'
  }));

  const campaignName = screen.getByDisplayValue('Flash Sale cuối tuần (Sao chép)');
  expect(screen.getByRole('checkbox').checked).toBe(true);

  fireEvent.change(campaignName, { target: { value: 'Flash Sale tuần mới' } });
  fireEvent.change(screen.getByLabelText('Bắt đầu'), {
    target: { value: '2026-12-01T10:00' }
  });
  fireEvent.change(screen.getByLabelText('Kết thúc'), {
    target: { value: '2026-12-01T12:00' }
  });
  fireEvent.click(screen.getByRole('button', { name: 'Lưu danh sách' }));

  await waitFor(() => {
    expect(saveFlashSaleDraft).toHaveBeenCalledWith('', expect.objectContaining({
      name: 'Flash Sale tuần mới',
      startsAt: '2026-12-01T10:00',
      endsAt: '2026-12-01T12:00',
      productIds: ['product-1']
    }));
  });

  await screen.findByText('BƯỚC 2 / 2');
  expect(screen.getByLabelText('Giá giảm (₫)').value).toBe('75.000');
  fireEvent.click(screen.getByRole('button', { name: 'Đăng chương trình' }));

  await waitFor(() => {
    expect(publishFlashSale).toHaveBeenCalledWith('campaign-copy', {
      'product-1': { salePrice: 75000 }
    });
  });
});
