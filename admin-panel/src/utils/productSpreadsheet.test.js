import ExcelJS from 'exceljs';
import {
  createProductImportTemplate,
  parseProductImportFile
} from './productSpreadsheet';

const createExcelFile = async (rows) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Products');
  rows.forEach((row) => worksheet.addRow(row));
  const buffer = await workbook.xlsx.writeBuffer();
  return { arrayBuffer: async () => buffer };
};

const headers = [
  'ID',
  'Tên sản phẩm',
  'Mô tả (HTML)',
  'Mã sản phẩm',
  'Giá bán (VNĐ)',
  'Tồn kho',
  'Danh mục',
  'Trạng thái',
  'Ảnh URL (ngăn cách bằng |)'
];

test('includes available categories and a dropdown in the import template', async () => {
  const workbook = createProductImportTemplate([
    { id: 'category-1', name: 'Đồ uống' },
    { id: 'category-2', name: 'Đồ ăn' }
  ]);
  const productsSheet = workbook.getWorksheet('Products');
  const categoriesSheet = workbook.getWorksheet('Danh mục');
  const validation = productsSheet.dataValidations.model['G2:G1001'];

  expect(categoriesSheet.getCell('A2').value).toBe('Đồ uống');
  expect(categoriesSheet.getCell('A3').value).toBe('Đồ ăn');
  expect(validation).toMatchObject({
    type: 'list',
    formulae: ['ProductCategories'],
    showErrorMessage: true
  });

  const exportedWorkbook = new ExcelJS.Workbook();
  await exportedWorkbook.xlsx.load(await workbook.xlsx.writeBuffer());
  expect(exportedWorkbook.getWorksheet('Products').dataValidations.model['G2:G1001'].formulae)
    .toEqual(['ProductCategories']);
  expect(exportedWorkbook.getWorksheet('Danh mục').getCell('A2').value).toBe('Đồ uống');
});

test('explains that admin categories are required if no categories exist', () => {
  const workbook = createProductImportTemplate();

  expect(workbook.getWorksheet('Danh mục').getCell('A2').value)
    .toContain('Chưa có danh mục');
  expect(workbook.getWorksheet('Products').dataValidations.model['G2:G1001']).toBeUndefined();
});

test('parses valid product rows and maps category names to IDs', async () => {
  const file = await createExcelFile([
    headers,
    ['', 'Bột mì', '<p><strong>Ngon</strong></p>', 'BOTMI-01', 20000, 12, 'Bột gia vị', 'Đang bán', 'https://example.com/image.jpg']
  ]);

  const result = await parseProductImportFile(file, [
    { id: 'category-1', name: 'Bột gia vị' }
  ], []);

  expect(result.errors).toEqual([]);
  expect(result.rows[0].productData).toMatchObject({
    name: 'Bột mì',
    description: '<p><strong>Ngon</strong></p>',
    sku: 'BOTMI-01',
    price: 20000,
    stock: 12,
    categoryId: 'category-1',
    imageUrls: ['https://example.com/image.jpg'],
    isActive: true
  });
});

test('rejects invalid rows before any products are written', async () => {
  const file = await createExcelFile([
    headers,
    ['', '', '', 'DUP-1', 'không phải giá', -2, 'Không tồn tại', 'Sai trạng thái', 'javascript:alert(1)']
  ]);

  const result = await parseProductImportFile(file, [], []);

  expect(result.rows).toEqual([]);
  expect(result.errors).toEqual(expect.arrayContaining([
    expect.stringContaining('thiếu tên sản phẩm'),
    expect.stringContaining('giá bán'),
    expect.stringContaining('tồn kho'),
    expect.stringContaining('không tìm thấy danh mục'),
    expect.stringContaining('trạng thái'),
    expect.stringContaining('ảnh phải là URL')
  ]));
});

test('updates by ID and retains existing images when the image cell is blank', async () => {
  const file = await createExcelFile([
    headers,
    ['product-1', 'Bột mì mới', '', 'BOTMI-01', 25000, 8, 'Bột gia vị', 'Đang bán', '']
  ]);
  const existingProduct = {
    id: 'product-1',
    sku: 'BOTMI-01',
    imageUrls: ['https://example.com/current.jpg']
  };

  const result = await parseProductImportFile(file, [
    { id: 'category-1', name: 'Bột gia vị' }
  ], [existingProduct]);

  expect(result.errors).toEqual([]);
  expect(result.rows[0].existing).toBe(existingProduct);
  expect(result.rows[0].productData).toMatchObject({
    name: 'Bột mì mới',
    imageUrls: ['https://example.com/current.jpg'],
    imageUrl: 'https://example.com/current.jpg'
  });
});
