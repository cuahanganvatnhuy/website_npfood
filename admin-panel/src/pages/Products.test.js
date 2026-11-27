import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Products from './Products.js';
import { getAllCategories } from '../services/categoryService.js';
import { deleteProducts, getAllProducts } from '../services/productService.js';

jest.mock('../services/categoryService.js', () => ({
  getAllCategories: jest.fn()
}));

jest.mock('../services/productService.js', () => ({
  createProduct: jest.fn(),
  deleteProduct: jest.fn(),
  deleteProducts: jest.fn(),
  getAllProducts: jest.fn(),
  updateProduct: jest.fn()
}));

jest.mock('../utils/productSpreadsheet.js', () => ({
  downloadProductImportTemplate: jest.fn(),
  exportProductsToExcel: jest.fn(),
  parseProductImportFile: jest.fn()
}));

jest.mock('../components/ProductDescriptionEditor.js', () => () => null);

test('paginates products, changes page size, and deletes checked products together', async () => {
  const products = Array.from({ length: 22 }, (_, index) => ({
    id: `product-${index + 1}`,
    name: `Sản phẩm ${index + 1}`,
    price: 10000,
    stock: 5,
    isActive: true
  }));
  getAllProducts.mockResolvedValue(products);
  getAllCategories.mockResolvedValue([]);
  deleteProducts.mockResolvedValue(undefined);
  const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);

  render(<Products />);

  const table = await screen.findByRole('table');
  const pageSize = screen.getByRole('combobox', { name: 'Số sản phẩm mỗi trang' });
  expect(within(table).getAllByRole('row')).toHaveLength(11);
  expect(screen.getByText('Hiển thị 1–10 / 22 sản phẩm')).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: 'Sau' }));
  expect(screen.getByText('Trang 2 / 3')).toBeTruthy();
  expect(screen.getByText('Sản phẩm 11')).toBeTruthy();

  fireEvent.change(pageSize, { target: { value: '20' } });
  expect(within(table).getAllByRole('row')).toHaveLength(21);
  expect(screen.getByText('Trang 1 / 2')).toBeTruthy();

  fireEvent.change(pageSize, { target: { value: '100' } });
  expect(within(table).getAllByRole('row')).toHaveLength(23);
  fireEvent.change(pageSize, { target: { value: '10' } });

  fireEvent.click(screen.getByRole('checkbox', { name: 'Chọn sản phẩm Sản phẩm 1' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Chọn sản phẩm Sản phẩm 2' }));
  fireEvent.click(screen.getByRole('button', { name: 'Xóa đã chọn (2)' }));

  await waitFor(() => {
    expect(deleteProducts).toHaveBeenCalledWith(['product-1', 'product-2']);
  });
  await waitFor(() => {
    expect(within(table).getAllByRole('row')).toHaveLength(11);
  });
  expect(confirmSpy).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Sản phẩm 1')).toBeNull();
  expect(screen.queryByText('Sản phẩm 2')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Xóa đã chọn (2)' })).toBeNull();
  confirmSpy.mockRestore();
});
