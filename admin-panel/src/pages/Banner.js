import { useState, useEffect } from 'react';
import { getAllBanners, createBanner, updateBanner, deleteBanner } from '../services/pageService.js';
import LoadingSpinner from '../components/LoadingSpinner.js';
import '../css/Banner.css';

const createEmptyForm = (order = 0) => ({
  title: '',
  description: '',
  link: '',
  imageUrl: '',
  order,
  isActive: true
});

const Banner = () => {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingBanner, setEditingBanner] = useState(null);
  const [formData, setFormData] = useState(createEmptyForm());

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    try {
      setLoadError('');
      setBanners(await getAllBanners());
    } catch (error) {
      console.error('Lỗi khi tải banner:', error);
      setLoadError(error.message || 'Không thể tải danh sách banner.');
    } finally {
      setLoading(false);
    }
  };

  const sortedBanners = [...banners].sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  const activeCount = banners.filter((banner) => banner.isActive !== false).length;

  const handleAddBanner = () => {
    setEditingBanner(null);
    const lastOrder = sortedBanners.reduce((maxOrder, banner) => Math.max(maxOrder, Number(banner.order) || 0), -1);
    setFormData(createEmptyForm(lastOrder + 1));
    setShowModal(true);
  };

  const handleEditBanner = (banner) => {
    setEditingBanner(banner);
    setFormData({
      title: banner.title || '',
      description: banner.description || '',
      link: banner.link || '',
      imageUrl: banner.imageUrl || '',
      order: Number(banner.order) || 0,
      isActive: banner.isActive !== false
    });
    setShowModal(true);
  };

  const handleDeleteBanner = async (bannerId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa banner này?')) return;
    try {
      await deleteBanner(bannerId);
      await fetchBanners();
    } catch (error) {
      console.error('Lỗi khi xóa banner:', error);
      alert('Xóa banner thất bại: ' + error.message);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (editingBanner) {
        await updateBanner(editingBanner.id, formData);
      } else {
        await createBanner(formData);
      }
      setShowModal(false);
      await fetchBanners();
    } catch (error) {
      console.error('Lỗi khi lưu banner:', error);
      alert('Lưu banner thất bại: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (banner) => {
    try {
      await updateBanner(banner.id, { isActive: banner.isActive === false });
      await fetchBanners();
    } catch (error) {
      console.error('Lỗi khi cập nhật trạng thái:', error);
      alert('Cập nhật trạng thái thất bại: ' + error.message);
    }
  };

  const handleImageUpload = (event) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn tệp hình ảnh.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setFormData((current) => ({ ...current, imageUrl: reader.result }));
      }
    };
    reader.onerror = () => alert('Không thể đọc tệp hình ảnh.');
    reader.readAsDataURL(file);
  };

  const moveBanner = async (banner, direction) => {
    const currentIndex = sortedBanners.findIndex((item) => item.id === banner.id);
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= sortedBanners.length) return;

    const reorderedBanners = [...sortedBanners];
    const [movedBanner] = reorderedBanners.splice(currentIndex, 1);
    reorderedBanners.splice(targetIndex, 0, movedBanner);
    try {
      await Promise.all(reorderedBanners.map((item, index) => updateBanner(item.id, { order: index })));
      await fetchBanners();
    } catch (error) {
      console.error('Lỗi khi thay đổi thứ tự:', error);
      alert('Thay đổi thứ tự banner thất bại: ' + error.message);
    }
  };

  return (
    <div className="banner-container">
      <div className="banner-page">
        <div className="banner-page-heading">
          <div>
            <span className="banner-eyebrow">TRANG TRÍ CỬA HÀNG</span>
            <h2>Quản lý banner</h2>
            <p>Quản lý hình ảnh nổi bật hiển thị trên trang cửa hàng.</p>
          </div>
          <button type="button" onClick={handleAddBanner} className="banner-add-button">
            <span aria-hidden="true">＋</span>
            Thêm banner
          </button>
        </div>

        <div className="banner-summary">
          <div className="banner-summary-icon">▧</div>
          <div><small>Tổng banner</small><strong>{banners.length}</strong></div>
          <span className="banner-summary-divider" />
          <div className="banner-summary-icon active">✓</div>
          <div><small>Đang hiển thị</small><strong>{activeCount}</strong></div>
          <span className="banner-summary-note">Sắp xếp thứ tự bằng các nút mũi tên trên từng banner.</span>
        </div>

        {loading ? (
          <div className="banner-loading">
            <LoadingSpinner message="Đang tải banner..." inline />
          </div>
        ) : loadError ? (
          <div className="banner-error" role="alert">
            <strong>Không tải được danh sách banner</strong>
            <p>{loadError}</p>
            <button type="button" onClick={() => { setLoading(true); fetchBanners(); }}>Thử lại</button>
          </div>
        ) : sortedBanners.length === 0 ? (
          <div className="banner-empty">
            <span aria-hidden="true">▧</span>
            <h3>Chưa có banner nào</h3>
            <p>Thêm banner để làm nổi bật sản phẩm hoặc chương trình của cửa hàng.</p>
            <button type="button" onClick={handleAddBanner} className="banner-add-button">Thêm banner đầu tiên</button>
          </div>
        ) : (
          <div className="banner-grid">
            {sortedBanners.map((banner, index) => (
              <article key={banner.id} className="banner-card">
                <div className="banner-image-wrap">
                  {banner.imageUrl ? (
                    <img src={banner.imageUrl} alt={banner.title || 'Banner cửa hàng'} className="banner-image" />
                  ) : (
                    <div className="banner-image-placeholder">
                      <span aria-hidden="true">▧</span>
                      <small>Chưa có hình ảnh</small>
                    </div>
                  )}
                  <span className="banner-order">VỊ TRÍ {index + 1}</span>
                  <span className={`banner-status ${banner.isActive === false ? 'inactive' : 'active'}`}>
                    <i />
                    {banner.isActive === false ? 'Đã ẩn' : 'Đang hiển thị'}
                  </span>
                </div>
                <div className="banner-card-body">
                  <h3>{banner.title || 'Chưa có tiêu đề'}</h3>
                  <p className="banner-description">{banner.description || 'Chưa có mô tả cho banner này.'}</p>
                  {banner.link && (
                    <a href={banner.link} target="_blank" rel="noopener noreferrer" className="banner-link">
                      {banner.link}
                    </a>
                  )}
                  <div className="banner-card-actions">
                    <div className="banner-order-actions">
                      <button type="button" onClick={() => moveBanner(banner, 'up')} disabled={index === 0} title="Đưa lên" aria-label="Đưa banner lên">↑</button>
                      <button type="button" onClick={() => moveBanner(banner, 'down')} disabled={index === sortedBanners.length - 1} title="Đưa xuống" aria-label="Đưa banner xuống">↓</button>
                    </div>
                    <div className="banner-edit-actions">
                      <button type="button" onClick={() => handleEditBanner(banner)} className="banner-edit">Chỉnh sửa</button>
                      <button type="button" onClick={() => handleToggleActive(banner)} className="banner-toggle">
                        {banner.isActive === false ? 'Hiển thị' : 'Ẩn'}
                      </button>
                      <button type="button" onClick={() => handleDeleteBanner(banner.id)} className="banner-delete" aria-label="Xóa banner">Xóa</button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="banner-modal-overlay">
          <div className="banner-modal" role="dialog" aria-modal="true" aria-labelledby="banner-modal-title">
            <div className="banner-modal-header">
              <div>
                <span className="banner-eyebrow">TRANG TRÍ CỬA HÀNG</span>
                <h3 id="banner-modal-title">{editingBanner ? 'Chỉnh sửa banner' : 'Thêm banner mới'}</h3>
              </div>
              <button type="button" onClick={() => setShowModal(false)} className="banner-modal-close" aria-label="Đóng">×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="banner-modal-body">
                <div className="banner-form-group">
                  <label htmlFor="banner-title">Tiêu đề</label>
                  <input id="banner-title" type="text" value={formData.title} onChange={(event) => setFormData({ ...formData, title: event.target.value })} placeholder="Ví dụ: Sản phẩm mới mùa này" />
                </div>
                <div className="banner-form-group">
                  <label htmlFor="banner-description">Mô tả</label>
                  <textarea id="banner-description" value={formData.description} onChange={(event) => setFormData({ ...formData, description: event.target.value })} rows={3} placeholder="Thông tin ngắn về banner..." />
                </div>
                <div className="banner-form-row">
                  <div className="banner-form-group">
                    <label htmlFor="banner-link">Liên kết (tùy chọn)</label>
                    <input id="banner-link" type="url" value={formData.link} onChange={(event) => setFormData({ ...formData, link: event.target.value })} placeholder="https://example.com" />
                  </div>
                  <div className="banner-form-group banner-order-field">
                    <label htmlFor="banner-order">Thứ tự</label>
                    <input id="banner-order" type="number" min="0" value={formData.order} onChange={(event) => setFormData({ ...formData, order: Number.parseInt(event.target.value, 10) || 0 })} />
                  </div>
                </div>
                <div className="banner-form-group">
                  <label htmlFor="banner-image-upload">Hình ảnh banner</label>
                  <input id="banner-image-upload" type="file" accept="image/*" onChange={handleImageUpload} className="banner-file-input" />
                  <div className="banner-image-picker">
                    <label htmlFor="banner-image-upload" className="banner-image-add">
                      <span>＋</span><strong>{formData.imageUrl ? 'Đổi hình ảnh' : 'Chọn hình ảnh'}</strong>
                      <small>Ảnh ngang phù hợp banner cửa hàng</small>
                    </label>
                    {formData.imageUrl && (
                      <div className="banner-image-preview">
                        <img src={formData.imageUrl} alt="Xem trước banner" />
                        <button type="button" onClick={() => setFormData({ ...formData, imageUrl: '' })} aria-label="Xóa ảnh">×</button>
                      </div>
                    )}
                  </div>
                </div>
                <label className="banner-active-toggle">
                  <input type="checkbox" checked={formData.isActive} onChange={(event) => setFormData({ ...formData, isActive: event.target.checked })} />
                  <span>Hiển thị banner ngay sau khi lưu</span>
                </label>
              </div>
              <div className="banner-modal-footer">
                <button type="button" onClick={() => setShowModal(false)} className="banner-cancel-button">Hủy</button>
                <button type="submit" className="banner-save-button" disabled={saving}>
                  {saving ? 'Đang lưu...' : editingBanner ? 'Lưu thay đổi' : 'Thêm banner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Banner;
