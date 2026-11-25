import { useState, useEffect } from 'react';
import { getAllCategories, createCategory, updateCategory, deleteCategory } from '../services/categoryService.js';
import LoadingSpinner from '../components/LoadingSpinner.js';
import { getCachedData, setCachedData, invalidateCache } from '../utils/dataCache.js';
import readImageFile from '../utils/readImageFile.js';
import '../css/Categories.css';

const MAX_CATEGORY_IMAGE_SIZE = 5 * 1024 * 1024;

const Categories = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: '',
    imageUrl: '',
    order: 0,
    isActive: true
  });
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      // Check cache first
      const cachedData = getCachedData('categories');
      if (cachedData) {
        setCategories(cachedData);
        setLoading(false);
        return;
      }

      const categoriesData = await Promise.race([
        getAllCategories(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 10000)
        )
      ]);
      setCategories(categoriesData);
      setCachedData('categories', categoriesData);
    } catch (error) {
      console.error('Lỗi khi tải danh mục:', error);
      // Still set loading to false even on error to show the page
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = () => {
    setEditingCategory(null);
    // Tự động tính order tiếp theo
    const maxOrder = categories.length > 0 ? Math.max(...categories.map(c => c.order || 0)) : 0;
    setFormData({
      name: '',
      description: '',
      icon: '',
      imageUrl: '',
      order: maxOrder + 1,
      isActive: true
    });
    setUploadingImage(false);
    setShowModal(true);
  };

  const handleEditCategory = (category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description,
      icon: category.icon || '',
      imageUrl: category.imageUrl || '',
      order: category.order || 0,
      isActive: category.isActive !== undefined ? category.isActive : true
    });
    setUploadingImage(false);
    setShowModal(true);
  };

  const handleImageUpload = async (event) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn tệp hình ảnh.');
      return;
    }
    if (file.size > MAX_CATEGORY_IMAGE_SIZE) {
      alert('Hình ảnh danh mục không được vượt quá 5 MB.');
      return;
    }

    setUploadingImage(true);
    try {
      const imageUrl = await readImageFile(file);
      setFormData((current) => ({ ...current, imageUrl }));
    } catch (error) {
      console.error('Lỗi khi đọc hình ảnh danh mục:', error);
      alert('Không thể đọc hình ảnh. Vui lòng thử lại.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa danh mục này?')) {
      try {
        await deleteCategory(categoryId);
        invalidateCache('categories');
        fetchCategories();
      } catch (error) {
        console.error('Lỗi khi xóa danh mục:', error);
        alert('Xóa danh mục thất bại: ' + error.message);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (uploadingImage) {
      alert('Vui lòng đợi hình ảnh xử lý xong.');
      return;
    }
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, formData);
      } else {
        await createCategory(formData);
      }
      setShowModal(false);
      invalidateCache('categories');
      fetchCategories();
    } catch (error) {
      console.error('Lỗi khi lưu danh mục:', error);
      alert('Lưu danh mục thất bại: ' + error.message);
    }
  };

  const handleToggleActive = async (category) => {
    try {
      await updateCategory(category.id, { isActive: !category.isActive });
      invalidateCache('categories');
      fetchCategories();
    } catch (error) {
      console.error('Lỗi khi cập nhật trạng thái:', error);
      alert('Cập nhật trạng thái thất bại: ' + error.message);
    }
  };

  return (
    <div className="categories-container">
      <div className="categories-page">
        <div className="categories-page-heading">
          <div>
            <span className="categories-eyebrow">QUẢN LÝ CỬA HÀNG</span>
            <h2>Danh mục sản phẩm</h2>
            <p>Sắp xếp sản phẩm thành từng nhóm để khách hàng dễ tìm kiếm.</p>
          </div>
          <div className="categories-summary">
            <div className="summary-icon">📁</div>
            <div>
              <span>Tổng danh mục</span>
              <strong>{categories.length}</strong>
            </div>
          </div>
        </div>

        <section className="categories-card">
          <div className="categories-card-header">
            <div>
              <h3>Danh sách danh mục</h3>
              <p>{categories.filter((category) => category.isActive !== false).length} danh mục đang kinh doanh</p>
            </div>
            <button onClick={handleAddCategory} className="category-add-button">
              <span aria-hidden="true">＋</span>
              Thêm danh mục
            </button>
          </div>

          {loading ? (
            <div className="categories-loading">
              <LoadingSpinner message="Đang tải danh mục..." inline />
            </div>
          ) : categories.length === 0 ? (
            <div className="categories-empty">
              <span aria-hidden="true">📦</span>
              <strong>Chưa có danh mục sản phẩm</strong>
              <p>Tạo danh mục đầu tiên để bắt đầu sắp xếp sản phẩm.</p>
              <button onClick={handleAddCategory} className="category-add-button">Thêm danh mục</button>
            </div>
          ) : (
            <div className="categories-table-scroll">
              <table className="categories-table">
                <thead>
                  <tr>
                    <th>Tên danh mục</th>
                    <th>Mô tả</th>
                    <th className="category-icon-column">Biểu tượng</th>
                    <th className="category-order-column">Thứ tự</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((category) => (
                    <tr key={category.id}>
                      <td className="category-name">{category.name}</td>
                      <td className="category-description">{category.description || '—'}</td>
                      <td className="category-icon-column">
                        <span className="category-icon">
                          {category.imageUrl ? (
                            <img src={category.imageUrl} alt="" />
                          ) : (
                            category.icon || '📦'
                          )}
                        </span>
                      </td>
                      <td className="category-order-column">
                        <span className="category-order">{category.order || 0}</span>
                      </td>
                      <td>
                        <span className={`category-status ${category.isActive !== false ? 'is-active' : 'is-inactive'}`}>
                          <span className="category-status-dot" />
                          {category.isActive !== false ? 'Đang bán' : 'Đã ẩn'}
                        </span>
                      </td>
                      <td>
                        <div className="category-actions">
                          <button
                            type="button"
                            onClick={() => handleEditCategory(category)}
                            className="category-action edit"
                            title="Sửa danh mục"
                          >
                            Sửa
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleActive(category)}
                            className="category-action toggle"
                            title={category.isActive !== false ? 'Ẩn danh mục' : 'Hiện danh mục'}
                          >
                            {category.isActive !== false ? 'Ẩn' : 'Hiện'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(category.id)}
                            className="category-action delete"
                            title="Xóa danh mục"
                          >
                            Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {showModal && (
        <div className="category-modal-overlay">
          <div
            className="category-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="category-modal-title"
          >
            <div className="category-modal-header">
              <div>
                <span className="categories-eyebrow">DANH MỤC SẢN PHẨM</span>
                <h3 id="category-modal-title">{editingCategory ? 'Chỉnh sửa danh mục' : 'Thêm danh mục mới'}</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="category-modal-close"
                aria-label="Đóng"
                disabled={uploadingImage}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="category-modal-body">
                <div className="form-group">
                  <label className="form-label" htmlFor="category-name">Tên danh mục</label>
                  <input
                    id="category-name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="form-input"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="category-description">Mô tả</label>
                  <textarea
                    id="category-description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="form-textarea"
                    rows={3}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="category-image">Hình ảnh danh mục</label>
                  <input
                    id="category-image"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="form-input category-image-input"
                    disabled={uploadingImage}
                  />
                  <small className="category-image-help">Chọn một ảnh, tối đa 5 MB.</small>
                  {formData.imageUrl && (
                    <div className="category-image-preview">
                      <img src={formData.imageUrl} alt="Xem trước ảnh danh mục" />
                      <button
                        type="button"
                        className="category-image-remove"
                        onClick={() => setFormData((current) => ({ ...current, imageUrl: '' }))}
                        disabled={uploadingImage}
                      >
                        Bỏ hình ảnh
                      </button>
                    </div>
                  )}
                  {uploadingImage && <small className="category-image-help">Đang xử lý hình ảnh...</small>}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="category-icon">Biểu tượng</label>
                  <div className="icon-picker-container">
                    <input
                      id="category-icon"
                      type="text"
                      value={formData.icon}
                      onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                      className="form-input icon-input"
                      placeholder="🥬"
                      maxLength={2}
                    />
                    <div className="icon-preview">
                      {formData.icon || '📁'}
                    </div>
                  </div>
                  <div className="icon-suggestions">
                    {['🥬', '🥩', '🐟', '🍎', '🥕', '🍞', '🥛', '🍚', '🧃', '🧂'].map(icon => (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => setFormData({ ...formData, icon })}
                        className="icon-suggestion-btn"
                        aria-label={`Chọn biểu tượng ${icon}`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="form-group checkbox-group">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="checkbox-input"
                  />
                  <span>Danh mục đang kinh doanh</span>
                </label>
              </div>
              <div className="category-modal-footer">
                <button type="submit" className="category-modal-submit" disabled={uploadingImage}>
                  {uploadingImage ? 'Đang xử lý ảnh...' : editingCategory ? 'Lưu thay đổi' : 'Tạo danh mục'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="category-modal-cancel"
                  disabled={uploadingImage}
                >
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Categories;
