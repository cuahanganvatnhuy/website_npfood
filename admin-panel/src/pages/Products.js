import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  createProduct,
  deleteProduct,
  deleteProducts,
  getAllProducts,
  updateProduct
} from '../services/productService.js';
import { getAllCategories } from '../services/categoryService.js';
import CurrencyInput from '../components/CurrencyInput.js';
import LoadingSpinner from '../components/LoadingSpinner.js';
import ProductDescriptionEditor from '../components/ProductDescriptionEditor.js';
import {
  getProductDescriptionText,
  sanitizeProductDescription
} from '../utils/productDescription.js';
import {
  downloadProductImportTemplate,
  exportProductsToExcel,
  parseProductImportFile
} from '../utils/productSpreadsheet.js';
import readImageFile from '../utils/readImageFile.js';
import '../css/Products.css';

const MAX_PRODUCT_IMAGES = 5;

const getProductImages = (product) => {
  if (Array.isArray(product.imageUrls) && product.imageUrls.length > 0) {
    return product.imageUrls.slice(0, MAX_PRODUCT_IMAGES);
  }
  return product.imageUrl ? [product.imageUrl] : [];
};

const emptyForm = {
  name: '',
  description: '',
  sku: '',
  price: '',
  stock: '',
  categoryId: '',
  imageUrls: [],
  isActive: true
};

const Products = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [productsPerPage, setProductsPerPage] = useState(10);
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [bulkDeleteError, setBulkDeleteError] = useState('');
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [spreadsheetBusy, setSpreadsheetBusy] = useState(false);
  const importFileRef = useRef(null);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  const fetchProducts = async () => {
    try {
      const loadedProducts = await getAllProducts();
      const availableIds = new Set(loadedProducts.map((product) => product.id));
      setProducts(loadedProducts);
      setSelectedProductIds((current) => current.filter((id) => availableIds.has(id)));
    } catch (error) {
      console.error('Lỗi khi tải sản phẩm:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      setCategories(await getAllCategories());
    } catch (error) {
      console.error('Lỗi khi tải danh mục sản phẩm:', error);
    }
  };

  const handleAddProduct = () => {
    setEditingProduct(null);
    setFormData({ ...emptyForm, imageUrls: [] });
    setShowModal(true);
  };

  const handleEditProduct = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name || '',
      description: product.description || '',
      sku: product.sku || '',
      price: product.price ?? '',
      stock: product.stock ?? '',
      categoryId: product.categoryId || '',
      imageUrls: getProductImages(product),
      isActive: product.isActive !== false
    });
    setShowModal(true);
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa sản phẩm này?')) return;
    try {
      await deleteProduct(productId);
      setSelectedProductIds((current) => current.filter((id) => id !== productId));
      await fetchProducts();
    } catch (error) {
      console.error('Lỗi khi xóa sản phẩm:', error);
      alert('Xóa sản phẩm thất bại: ' + error.message);
    }
  };

  const handleDeleteSelectedProducts = async () => {
    const selectedIds = products
      .filter((product) => selectedProductIds.includes(product.id))
      .map((product) => product.id);
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Bạn có chắc chắn muốn xóa ${selectedIds.length} sản phẩm đã chọn? Thao tác này không thể hoàn tác.`)) return;

    setDeletingSelected(true);
    setBulkDeleteError('');
    try {
      await deleteProducts(selectedIds);
      const deletedIds = new Set(selectedIds);
      setProducts((current) => current.filter((product) => !deletedIds.has(product.id)));
      setSelectedProductIds((current) => current.filter((id) => !deletedIds.has(id)));
    } catch (error) {
      console.error('Lỗi khi xóa các sản phẩm đã chọn:', error);
      setBulkDeleteError(`Xóa sản phẩm thất bại: ${error.message || 'Vui lòng thử lại.'}`);
    } finally {
      setDeletingSelected(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const images = formData.imageUrls.slice(0, MAX_PRODUCT_IMAGES);
    const productData = {
      ...formData,
      description: sanitizeProductDescription(formData.description),
      imageUrls: images,
      imageUrl: images[0] || '',
      price: Number(formData.price),
      stock: Number(formData.stock)
    };

    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, productData);
      } else {
        await createProduct(productData);
      }
      setShowModal(false);
      await fetchProducts();
    } catch (error) {
      console.error('Lỗi khi lưu sản phẩm:', error);
      alert('Lưu sản phẩm thất bại: ' + error.message);
    }
  };

  const handleToggleActive = async (product) => {
    try {
      await updateProduct(product.id, { isActive: product.isActive === false });
      await fetchProducts();
    } catch (error) {
      console.error('Lỗi khi cập nhật trạng thái sản phẩm:', error);
      alert('Cập nhật trạng thái thất bại: ' + error.message);
    }
  };

  const handleImageUpload = async (event) => {
    const files = Array.from(event.currentTarget.files || []);
    event.currentTarget.value = '';
    if (files.length === 0) return;

    const availableSlots = MAX_PRODUCT_IMAGES - formData.imageUrls.length;
    if (availableSlots <= 0) {
      alert(`Mỗi sản phẩm chỉ được tải tối đa ${MAX_PRODUCT_IMAGES} hình.`);
      return;
    }

    const imageFiles = files.filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length !== files.length) {
      alert('Một số tệp không phải hình ảnh và đã được bỏ qua.');
    }
    if (imageFiles.length > availableSlots) {
      alert(`Chỉ có thể thêm ${availableSlots} hình nữa. Tối đa ${MAX_PRODUCT_IMAGES} hình cho mỗi sản phẩm.`);
    }

    setUploadingImages(true);
    try {
      const newImages = await Promise.all(imageFiles.slice(0, availableSlots).map(readImageFile));
      setFormData((current) => ({
        ...current,
        imageUrls: [...current.imageUrls, ...newImages].slice(0, MAX_PRODUCT_IMAGES)
      }));
    } catch (error) {
      console.error('Lỗi khi đọc hình ảnh sản phẩm:', error);
      alert('Không thể tải một hoặc nhiều hình ảnh. Vui lòng thử lại.');
    } finally {
      setUploadingImages(false);
    }
  };

  const handleRemoveImage = (indexToRemove) => {
    setFormData((current) => ({
      ...current,
      imageUrls: current.imageUrls.filter((_, index) => index !== indexToRemove)
    }));
  };

  const handleExportProducts = async () => {
    setSpreadsheetBusy(true);
    try {
      await exportProductsToExcel(products, categories);
    } catch (error) {
      console.error('Lỗi khi xuất file sản phẩm:', error);
      alert(`Xuất file Excel thất bại: ${error.message || 'Vui lòng thử lại.'}`);
    } finally {
      setSpreadsheetBusy(false);
    }
  };

  const handleDownloadImportTemplate = async () => {
    setSpreadsheetBusy(true);
    try {
      const currentCategories = await getAllCategories();
      setCategories(currentCategories);
      await downloadProductImportTemplate(currentCategories);
    } catch (error) {
      console.error('Lỗi khi tạo mẫu Excel sản phẩm:', error);
      alert(`Tải mẫu Excel thất bại: ${error.message || 'Vui lòng thử lại.'}`);
    } finally {
      setSpreadsheetBusy(false);
    }
  };

  const handleImportProducts = async (event) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;

    setSpreadsheetBusy(true);
    try {
      const { rows, errors } = await parseProductImportFile(file, categories, products);
      if (errors.length > 0) {
        const shownErrors = errors.slice(0, 8).join('\n');
        const remainingCount = errors.length - Math.min(errors.length, 8);
        alert(
          `File có ${errors.length} lỗi nên chưa nhập sản phẩm nào:\n${shownErrors}` +
          (remainingCount > 0 ? `\n...và ${remainingCount} lỗi khác.` : '')
        );
        return;
      }

      let successCount = 0;
      const writeErrors = [];
      for (const row of rows) {
        try {
          if (row.productId) {
            await updateProduct(row.productId, row.productData);
          } else {
            await createProduct(row.productData);
          }
          successCount += 1;
        } catch (error) {
          console.error(`Lỗi khi nhập sản phẩm ở dòng ${row.rowNumber}:`, error);
          writeErrors.push(`Dòng ${row.rowNumber}: ${error.message || 'Không thể lưu sản phẩm.'}`);
        }
      }

      await fetchProducts();
      const writeErrorSummary = writeErrors.slice(0, 8).join('\n');
      const remainingErrorCount = writeErrors.length - Math.min(writeErrors.length, 8);
      alert(
        `Đã nhập/cập nhật ${successCount}/${rows.length} sản phẩm.` +
        (writeErrors.length > 0
          ? `\nCác dòng chưa lưu được:\n${writeErrorSummary}` +
            (remainingErrorCount > 0 ? `\n...và ${remainingErrorCount} lỗi khác.` : '')
          : '')
      );
    } catch (error) {
      console.error('Lỗi khi đọc file Excel sản phẩm:', error);
      alert(`Không thể nhập file Excel: ${error.message || 'Vui lòng dùng file .xlsx hợp lệ.'}`);
    } finally {
      setSpreadsheetBusy(false);
    }
  };

  const filteredProducts = products.filter((product) => {
    const search = searchTerm.toLocaleLowerCase();
    return [product.name, getProductDescriptionText(product.description), product.sku]
      .some((value) => String(value || '').toLocaleLowerCase().includes(search));
  });
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / productsPerPage));
  const displayedPage = Math.min(currentPage, totalPages);
  const firstVisibleProduct = (displayedPage - 1) * productsPerPage;
  const paginatedProducts = filteredProducts.slice(
    firstVisibleProduct,
    firstVisibleProduct + productsPerPage
  );
  const allCurrentPageSelected = paginatedProducts.length > 0 &&
    paginatedProducts.every((product) => selectedProductIds.includes(product.id));
  const activeProducts = products.filter((product) => product.isActive !== false).length;

  return (
    <div className="products-container">
      <div className="products-page">
        <div className="products-page-heading">
          <div>
            <span className="products-eyebrow">QUẢN LÝ CỬA HÀNG</span>
            <h2>Sản phẩm</h2>
            <p>Quản lý thông tin, giá bán và số lượng tồn kho.</p>
          </div>
          <div className="products-summary">
            <span className="products-summary-icon">📦</span>
            <span className="products-summary-stat">
              <small>Tổng sản phẩm</small>
              <strong>{products.length}</strong>
            </span>
            <span className="products-summary-divider" />
            <span className="products-summary-stat">
              <small>Đang kinh doanh</small>
              <strong>{activeProducts}</strong>
            </span>
          </div>
        </div>

        <section className="products-card">
          <div className="products-card-header">
            <div>
              <h3>Danh sách sản phẩm</h3>
              <p>{filteredProducts.length} sản phẩm</p>
            </div>
            <div className="products-toolbar">
              <input
                ref={importFileRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={handleImportProducts}
                className="product-import-input"
                aria-label="Chọn file Excel sản phẩm"
              />
              <input
                type="search"
                placeholder="Tìm sản phẩm..."
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setCurrentPage(1);
                }}
                className="product-search"
                aria-label="Tìm sản phẩm"
              />
              {selectedProductIds.length > 0 && (
                <button
                  type="button"
                  className="product-bulk-delete"
                  onClick={handleDeleteSelectedProducts}
                  disabled={deletingSelected}
                >
                  {deletingSelected
                    ? 'Đang xóa...'
                    : `Xóa đã chọn (${selectedProductIds.length})`}
                </button>
              )}
              <button
                type="button"
                onClick={handleDownloadImportTemplate}
                className="product-spreadsheet-button"
                disabled={spreadsheetBusy}
              >
                Tải mẫu
              </button>
              <button
                type="button"
                onClick={() => importFileRef.current?.click()}
                className="product-spreadsheet-button"
                disabled={spreadsheetBusy}
              >
                {spreadsheetBusy ? 'Đang xử lý...' : 'Nhập Excel'}
              </button>
              <button
                type="button"
                onClick={handleExportProducts}
                className="product-spreadsheet-button"
                disabled={spreadsheetBusy || products.length === 0}
              >
                Xuất Excel
              </button>
              <button
                type="button"
                onClick={handleAddProduct}
                className="product-add-button"
                disabled={spreadsheetBusy}
              >
                <span aria-hidden="true">＋</span>
                Thêm sản phẩm
              </button>
            </div>
          </div>

          {bulkDeleteError && (
            <p className="product-bulk-delete-error" role="alert">{bulkDeleteError}</p>
          )}

          {loading ? (
            <div className="products-loading">
              <LoadingSpinner message="Đang tải sản phẩm..." inline />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="products-empty">
              <span aria-hidden="true">📦</span>
              <strong>{searchTerm ? 'Không tìm thấy sản phẩm' : 'Chưa có sản phẩm'}</strong>
              <p>{searchTerm ? 'Thử từ khóa tìm kiếm khác.' : 'Thêm sản phẩm đầu tiên vào cửa hàng của bạn.'}</p>
              {!searchTerm && <button onClick={handleAddProduct} className="product-add-button">Thêm sản phẩm</button>}
            </div>
          ) : (
            <>
              <div className="products-table-scroll">
              <table className="products-table">
                <thead>
                  <tr>
                    <th className="product-select-cell">
                      <input
                        type="checkbox"
                        className="product-select-checkbox"
                        aria-label="Chọn tất cả sản phẩm trên trang này"
                        checked={allCurrentPageSelected}
                        disabled={deletingSelected}
                        onChange={(event) => {
                          const shouldSelect = event.target.checked;
                          const currentPageIds = paginatedProducts.map((product) => product.id);
                          setSelectedProductIds((current) => {
                            const next = new Set(current);
                            currentPageIds.forEach((id) => {
                              if (shouldSelect) next.add(id);
                              else next.delete(id);
                            });
                            return [...next];
                          });
                        }}
                      />
                    </th>
                    <th>Sản phẩm</th>
                    <th>Danh mục</th>
                    <th>Giá bán</th>
                    <th>Tồn kho</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedProducts.map((product) => {
                    const category = categories.find((item) => item.id === product.categoryId);
                    const primaryImage = getProductImages(product)[0];
                    return (
                      <tr key={product.id}>
                        <td className="product-select-cell">
                          <input
                            type="checkbox"
                            className="product-select-checkbox"
                            aria-label={`Chọn sản phẩm ${product.name}`}
                            checked={selectedProductIds.includes(product.id)}
                            disabled={deletingSelected}
                            onChange={(event) => {
                              setSelectedProductIds((current) => event.target.checked
                                ? [...new Set([...current, product.id])]
                                : current.filter((id) => id !== product.id));
                            }}
                          />
                        </td>
                        <td>
                          <div className="product-cell">
                            {primaryImage ? (
                              <img src={primaryImage} alt={product.name} className="product-thumb" />
                            ) : (
                              <span className="product-thumb product-thumb-empty">📦</span>
                            )}
                            <div className="product-info">
                              <div className="product-name">{product.name}</div>
                              {product.sku && <div className="product-sku">Mã SP: {product.sku}</div>}
                              {product.description && (
                                <div className="product-description">
                                  {getProductDescriptionText(product.description)}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          {category ? (
                            <span className="product-category">
                              {category.icon && <span>{category.icon}</span>}
                              {category.name}
                            </span>
                          ) : <span className="product-muted">Chưa phân loại</span>}
                        </td>
                        <td className="product-price">{Number(product.price || 0).toLocaleString('vi-VN')} ₫</td>
                        <td>{Number(product.stock || 0).toLocaleString('vi-VN')}</td>
                        <td>
                          <span className={`product-status ${product.isActive === false ? 'is-inactive' : 'is-active'}`}>
                            <span className="product-status-dot" />
                            {product.isActive === false ? 'Ngừng bán' : 'Đang bán'}
                          </span>
                        </td>
                        <td>
                          <div className="product-actions">
                            <button type="button" onClick={() => handleEditProduct(product)} className="product-action edit">Sửa</button>
                            <button type="button" onClick={() => handleToggleActive(product)} className="product-action toggle">
                              {product.isActive === false ? 'Mở bán' : 'Ẩn'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteProduct(product.id)}
                              className="product-action delete"
                              disabled={deletingSelected}
                            >
                              Xóa
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
              <div className="products-pagination">
                <div className="products-pagination-info">
                  <span>
                    Hiển thị {firstVisibleProduct + 1}–{firstVisibleProduct + paginatedProducts.length} / {filteredProducts.length} sản phẩm
                  </span>
                  <label className="products-page-size">
                    <span>Số sản phẩm mỗi trang</span>
                    <select
                      value={productsPerPage}
                      onChange={(event) => {
                        setProductsPerPage(Number(event.target.value));
                        setCurrentPage(1);
                      }}
                      aria-label="Số sản phẩm mỗi trang"
                    >
                      <option value={10}>10 / trang</option>
                      <option value={20}>20 / trang</option>
                      <option value={100}>100 / trang</option>
                    </select>
                  </label>
                </div>
                <nav className="products-pagination-controls" aria-label="Phân trang sản phẩm">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(displayedPage - 1)}
                    disabled={displayedPage === 1}
                  >
                    Trước
                  </button>
                  <span>Trang {displayedPage} / {totalPages}</span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(displayedPage + 1)}
                    disabled={displayedPage === totalPages}
                  >
                    Sau
                  </button>
                </nav>
              </div>
            </>
          )}
        </section>
      </div>

      {showModal && createPortal(
        <div className="product-modal-overlay">
          <div className="product-modal" role="dialog" aria-modal="true" aria-labelledby="product-modal-title">
            <div className="product-modal-header">
              <div>
                <span className="products-eyebrow">THÔNG TIN CỬA HÀNG</span>
                <h3 id="product-modal-title">{editingProduct ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm mới'}</h3>
              </div>
              <button type="button" onClick={() => setShowModal(false)} className="product-modal-close" aria-label="Đóng">×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="product-modal-body">
                <div className="product-form-grid">
                  <div className="product-form-group">
                    <label className="product-form-label" htmlFor="product-name">Tên sản phẩm</label>
                    <input id="product-name" value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} className="product-form-input" required />
                  </div>
                  <div className="product-form-group">
                    <label className="product-form-label" htmlFor="product-sku">Mã sản phẩm</label>
                    <input id="product-sku" value={formData.sku} onChange={(event) => setFormData({ ...formData, sku: event.target.value })} className="product-form-input" />
                  </div>
                  <div className="product-form-group product-form-full">
                    <label className="product-form-label" htmlFor="product-description">Mô tả sản phẩm</label>
                    <ProductDescriptionEditor
                      key={editingProduct?.id || 'new-product'}
                      initialValue={formData.description}
                      onChange={(description) => setFormData((current) => ({
                        ...current,
                        description
                      }))}
                    />
                  </div>
                  <div className="product-form-group">
                    <label className="product-form-label" htmlFor="product-category">Danh mục</label>
                    <select id="product-category" value={formData.categoryId} onChange={(event) => setFormData({ ...formData, categoryId: event.target.value })} className="product-form-input">
                      <option value="">Chọn danh mục</option>
                      {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                    </select>
                  </div>
                  <div className="product-form-group">
                    <label className="product-form-label" htmlFor="product-price">Giá bán (VNĐ)</label>
                    <CurrencyInput id="product-price" value={formData.price} onValueChange={(value) => setFormData({ ...formData, price: value })} className="product-form-input" required />
                  </div>
                  <div className="product-form-group">
                    <label className="product-form-label" htmlFor="product-stock">Số lượng tồn kho</label>
                    <input id="product-stock" type="number" min="0" step="1" value={formData.stock} onChange={(event) => setFormData({ ...formData, stock: event.target.value })} className="product-form-input" required />
                  </div>
                  <div className="product-form-group product-form-full">
                    <div className="product-images-heading">
                      <label className="product-form-label" htmlFor="product-image">Hình ảnh sản phẩm</label>
                      <span>{formData.imageUrls.length} / {MAX_PRODUCT_IMAGES}</span>
                    </div>
                    <div className="product-image-grid">
                      {formData.imageUrls.map((imageUrl, index) => (
                        <div className="product-image-card" key={`${index}-${imageUrl.slice(0, 32)}`}>
                          <img src={imageUrl} alt={`Ảnh sản phẩm ${index + 1}`} />
                          {index === 0 && <span className="product-image-primary">Ảnh đại diện</span>}
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(index)}
                            className="product-image-remove"
                            aria-label={`Xóa ảnh ${index + 1}`}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      {formData.imageUrls.length < MAX_PRODUCT_IMAGES && (
                        <label className={`product-image-add ${uploadingImages ? 'is-uploading' : ''}`} htmlFor="product-image">
                          <span>{uploadingImages ? '…' : '＋'}</span>
                          <small>{uploadingImages ? 'Đang xử lý' : 'Thêm ảnh'}</small>
                        </label>
                      )}
                    </div>
                    <p className="product-images-help">Tải tối đa 5 hình. Hình đầu tiên sẽ làm ảnh đại diện.</p>
                    <input
                      id="product-image"
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={uploadingImages || formData.imageUrls.length >= MAX_PRODUCT_IMAGES}
                      onChange={handleImageUpload}
                      className="product-image-input"
                    />
                  </div>
                  <label className="product-form-group product-form-full product-checkbox">
                    <input type="checkbox" checked={formData.isActive} onChange={(event) => setFormData({ ...formData, isActive: event.target.checked })} />
                    <span>Đang kinh doanh</span>
                  </label>
                </div>
              </div>
              <div className="product-modal-footer">
                <button type="button" onClick={() => setShowModal(false)} className="product-modal-cancel">Hủy</button>
                <button type="submit" className="product-modal-submit" disabled={uploadingImages}>
                  {uploadingImages ? 'Đang xử lý ảnh...' : editingProduct ? 'Lưu thay đổi' : 'Thêm sản phẩm'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Products;
