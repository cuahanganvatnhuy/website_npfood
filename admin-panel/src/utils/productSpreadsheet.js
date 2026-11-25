import ExcelJS from 'exceljs';
import { sanitizeProductDescription } from './productDescription.js';

const PRODUCT_SHEET_NAME = 'Products';
const productHeaders = [
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

const normalizeText = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/gi, 'd')
  .trim()
  .toLocaleLowerCase();

const getCellValue = (cell) => {
  const value = cell?.value;
  if (value && typeof value === 'object') {
    if ('result' in value) return value.result;
    if ('text' in value) return value.text;
    if ('richText' in value) return value.richText.map((item) => item.text).join('');
  }
  return value;
};

const parseNumber = (value, { integer = false } = {}) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 && (!integer || Number.isInteger(value))
      ? value
      : null;
  }

  const raw = String(value || '').trim();
  if (!raw || raw.startsWith('-')) return null;
  const cleaned = raw.replace(/[^\d.,]/g, '');
  if (!cleaned) return null;

  const isGroupedInteger = /^\d{1,3}(?:[.,]\d{3})+$/.test(cleaned);
  const normalized = isGroupedInteger ? cleaned.replace(/[.,]/g, '') : cleaned.replace(',', '.');
  const number = Number(normalized);
  return Number.isFinite(number) && number >= 0 && (!integer || Number.isInteger(number))
    ? number
    : null;
};

const parseActiveStatus = (value) => {
  if (value === undefined || value === null || value === '') return true;
  if (typeof value === 'boolean') return value;
  const normalized = normalizeText(value);
  if (['dang ban', 'dang kinh doanh', 'active', 'true', '1', 'co'].includes(normalized)) return true;
  if (['ngung ban', 'an', 'inactive', 'false', '0', 'khong'].includes(normalized)) return false;
  return null;
};

const getHeaderIndexes = (headerRow) => {
  const indexes = new Map();
  headerRow.eachCell((cell, columnNumber) => {
    indexes.set(normalizeText(getCellValue(cell)), columnNumber);
  });
  return indexes;
};

const findHeaderIndex = (indexes, aliases) => (
  aliases.map((alias) => indexes.get(normalizeText(alias))).find(Boolean)
);

const downloadWorkbook = async (workbook, fileName) => {
  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const styleHeader = (worksheet) => {
  const header = worksheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF3F7412' }
  };
  header.alignment = { vertical: 'middle', wrapText: true };
  header.height = 30;
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: productHeaders.length }
  };
};

const getCategoryName = (product, categories) => (
  categories.find((category) => category.id === product.categoryId)?.name || ''
);

const getExportableImageUrls = (product) => {
  const images = Array.isArray(product.imageUrls)
    ? product.imageUrls
    : [product.imageUrl || ''];
  return images
    .filter((image) => /^https?:\/\//i.test(String(image || '')))
    .join(' | ');
};

const addProductColumns = (worksheet) => {
  worksheet.columns = [
    { header: productHeaders[0], key: 'id', width: 22 },
    { header: productHeaders[1], key: 'name', width: 32 },
    { header: productHeaders[2], key: 'description', width: 48 },
    { header: productHeaders[3], key: 'sku', width: 20 },
    { header: productHeaders[4], key: 'price', width: 18 },
    { header: productHeaders[5], key: 'stock', width: 14 },
    { header: productHeaders[6], key: 'category', width: 24 },
    { header: productHeaders[7], key: 'status', width: 18 },
    { header: productHeaders[8], key: 'images', width: 48 }
  ];
  styleHeader(worksheet);
};

export const exportProductsToExcel = async (products, categories) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'NP Food Admin';
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet(PRODUCT_SHEET_NAME);
  addProductColumns(worksheet);

  products.forEach((product) => {
    worksheet.addRow({
      id: product.id,
      name: product.name || '',
      description: product.description || '',
      sku: product.sku || '',
      price: Number(product.price) || 0,
      stock: Number(product.stock) || 0,
      category: getCategoryName(product, categories),
      status: product.isActive === false ? 'Ngừng bán' : 'Đang bán',
      images: getExportableImageUrls(product)
    });
  });

  await downloadWorkbook(workbook, 'danh-sach-san-pham.xlsx');
};

export const createProductImportTemplate = (categories = []) => {
  const workbook = new ExcelJS.Workbook();
  const instructions = workbook.addWorksheet('Huong dan');
  const categoryNames = categories
    .map((category) => String(category.name || '').trim())
    .filter(Boolean);
  instructions.addRows([
    ['HƯỚNG DẪN NHẬP SẢN PHẨM'],
    ['Điền thông tin sản phẩm trong sheet Products, mỗi dòng là một sản phẩm.'],
    ['Tên sản phẩm, Giá bán và Tồn kho là thông tin bắt buộc.'],
    ['Chọn danh mục trong danh sách thả xuống của cột Danh mục. Danh sách nằm trong sheet Danh mục.'],
    ['Để cập nhật sản phẩm hiện có, giữ nguyên ID. Để thêm mới, để trống ID.'],
    ['Mô tả HTML là tùy chọn. Ảnh chỉ nhận URL http/https, phân cách nhiều ảnh bằng dấu |.'],
    ['Giá bán và Tồn kho nhập dạng số; Trạng thái dùng Đang bán hoặc Ngừng bán.'],
    ...(categoryNames.length === 0
      ? [['Hiện chưa có danh mục. Hãy tạo danh mục trong admin trước khi nhập sản phẩm.']]
      : [])
  ]);
  instructions.getColumn(1).width = 110;
  instructions.getRow(1).font = { bold: true, size: 15, color: { argb: 'FF28520C' } };
  instructions.getColumn(1).alignment = { wrapText: true, vertical: 'middle' };

  const worksheet = workbook.addWorksheet(PRODUCT_SHEET_NAME);
  addProductColumns(worksheet);
  const categoryWorksheet = workbook.addWorksheet('Danh mục');
  categoryWorksheet.getColumn(1).width = 38;
  categoryWorksheet.getCell('A1').value = 'Danh sách danh mục';
  categoryWorksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  categoryWorksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF3F7412' }
  };
  categoryWorksheet.views = [{ state: 'frozen', ySplit: 1 }];

  if (categoryNames.length > 0) {
    categoryNames.forEach((name, index) => {
      categoryWorksheet.getCell(`A${index + 2}`).value = name;
    });
    workbook.definedNames.add(
      `'Danh mục'!$A$2:$A$${categoryNames.length + 1}`,
      'ProductCategories'
    );
    const categoryColumn = 'G';
    worksheet.dataValidations.add(`${categoryColumn}2:${categoryColumn}1001`, {
      type: 'list',
      allowBlank: true,
      formulae: ['ProductCategories'],
      showInputMessage: true,
      promptTitle: 'Chọn danh mục',
      prompt: 'Chọn một danh mục có sẵn từ danh sách.',
      showErrorMessage: true,
      errorTitle: 'Danh mục không hợp lệ',
      error: 'Hãy chọn danh mục trong danh sách ở sheet Danh mục.'
    });
  } else {
    categoryWorksheet.getCell('A2').value = 'Chưa có danh mục nào được tạo trong admin.';
  }

  return workbook;
};

export const downloadProductImportTemplate = async (categories = []) => {
  const workbook = createProductImportTemplate(categories);
  await downloadWorkbook(workbook, 'mau-nhap-san-pham.xlsx');
};

export const parseProductImportFile = async (file, categories, existingProducts) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const worksheet = workbook.getWorksheet(PRODUCT_SHEET_NAME) || workbook.worksheets[0];
  if (!worksheet) throw new Error('Tệp Excel không có trang tính nào.');

  const headerIndexes = getHeaderIndexes(worksheet.getRow(1));
  const columns = {
    id: findHeaderIndex(headerIndexes, ['ID']),
    name: findHeaderIndex(headerIndexes, ['Tên sản phẩm', 'Tên']),
    description: findHeaderIndex(headerIndexes, ['Mô tả (HTML)', 'Mô tả']),
    sku: findHeaderIndex(headerIndexes, ['Mã sản phẩm', 'SKU']),
    price: findHeaderIndex(headerIndexes, ['Giá bán (VNĐ)', 'Giá bán', 'Giá']),
    stock: findHeaderIndex(headerIndexes, ['Tồn kho', 'Số lượng']),
    category: findHeaderIndex(headerIndexes, ['Danh mục']),
    status: findHeaderIndex(headerIndexes, ['Trạng thái']),
    images: findHeaderIndex(headerIndexes, ['Ảnh URL (ngăn cách bằng |)', 'Ảnh URL', 'Hình ảnh'])
  };

  const missingColumns = ['name', 'price', 'stock'].filter((key) => !columns[key]);
  if (missingColumns.length > 0) {
    throw new Error('Thiếu cột bắt buộc: Tên sản phẩm, Giá bán (VNĐ), Tồn kho.');
  }

  const categoriesByName = new Map(
    categories.map((category) => [normalizeText(category.name), category])
  );
  const productsById = new Map(existingProducts.map((product) => [product.id, product]));
  const productsBySku = new Map(
    existingProducts.filter((product) => product.sku)
      .map((product) => [normalizeText(product.sku), product])
  );
  const rows = [];
  const errors = [];
  const importedSkuRows = new Map();

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const getValue = (key) => columns[key] ? getCellValue(row.getCell(columns[key])) : '';
    const values = Object.values(columns).filter(Boolean).map((column) => getCellValue(row.getCell(column)));
    if (values.every((value) => value === null || value === undefined || value === '')) continue;

    const productId = String(getValue('id') || '').trim();
    const name = String(getValue('name') || '').trim();
    const sku = String(getValue('sku') || '').trim();
    const price = parseNumber(getValue('price'));
    const stock = parseNumber(getValue('stock'), { integer: true });
    const status = parseActiveStatus(getValue('status'));
    const existing = productId ? productsById.get(productId) : null;

    if (!name) errors.push(`Dòng ${rowNumber}: thiếu tên sản phẩm.`);
    if (price === null) errors.push(`Dòng ${rowNumber}: giá bán phải là số không âm.`);
    if (stock === null) errors.push(`Dòng ${rowNumber}: tồn kho phải là số nguyên không âm.`);
    if (status === null) errors.push(`Dòng ${rowNumber}: trạng thái phải là Đang bán hoặc Ngừng bán.`);
    if (productId && !existing) errors.push(`Dòng ${rowNumber}: ID "${productId}" không tồn tại.`);

    const categoryName = String(getValue('category') || '').trim();
    const category = categoryName ? categoriesByName.get(normalizeText(categoryName)) : null;
    if (categoryName && !category) {
      errors.push(`Dòng ${rowNumber}: không tìm thấy danh mục "${categoryName}".`);
    }

    const normalizedSku = normalizeText(sku);
    if (normalizedSku) {
      const previousRow = importedSkuRows.get(normalizedSku);
      if (previousRow) {
        errors.push(`Dòng ${rowNumber}: mã sản phẩm trùng với dòng ${previousRow} trong tệp.`);
      } else {
        importedSkuRows.set(normalizedSku, rowNumber);
      }
      const skuOwner = productsBySku.get(normalizedSku);
      if (skuOwner && skuOwner.id !== productId) {
        errors.push(`Dòng ${rowNumber}: mã sản phẩm "${sku}" đã được sử dụng.`);
      }
    }

    const rawImages = String(getValue('images') || '').trim();
    const imageUrls = rawImages
      ? rawImages.split('|').map((url) => url.trim()).filter(Boolean)
      : null;
    const existingImages = existing?.imageUrls ||
      (existing?.imageUrl ? [existing.imageUrl] : []);
    if (imageUrls?.some((url) => !/^https?:\/\//i.test(url))) {
      errors.push(`Dòng ${rowNumber}: ảnh phải là URL http/https.`);
    }

    rows.push({
      rowNumber,
      productId,
      existing,
      productData: {
        name,
        description: sanitizeProductDescription(getValue('description')),
        sku,
        price,
        stock,
        categoryId: category?.id || '',
        imageUrls: imageUrls || existingImages,
        imageUrl: (imageUrls || existingImages)[0] || '',
        isActive: status === null ? true : status
      }
    });
  }

  if (rows.length === 0) throw new Error('Không tìm thấy dòng sản phẩm nào trong tệp Excel.');
  if (errors.length > 0) return { rows: [], errors };
  return { rows, errors: [] };
};
