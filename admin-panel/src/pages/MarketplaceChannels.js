import { useEffect, useState } from 'react';
import {
  createMarketplaceChannel,
  deleteMarketplaceChannel,
  getAllMarketplaceChannels,
  updateMarketplaceChannel
} from '../services/marketplaceChannelService.js';
import LoadingSpinner from '../components/LoadingSpinner.js';
import '../css/MarketplaceChannels.css';

const createEmptyForm = (order = 0) => ({
  name: '',
  url: '',
  order,
  isActive: true
});

const isExternalHttpUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
};

const getMarketplaceErrorMessage = (error, fallback) => {
  const errorDetails = `${error?.code || ''} ${error?.message || ''}`.toUpperCase();
  if (errorDetails.includes('PERMISSION_DENIED') || errorDetails.includes('PERMISSION DENIED')) {
    return 'Firebase đang chặn quyền ghi. Hãy publish database.rules.json và đăng nhập bằng tài khoản admin@gmail.com.';
  }
  return error?.message || fallback;
};

const MarketplaceChannels = () => {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingChannel, setEditingChannel] = useState(null);
  const [formError, setFormError] = useState('');
  const [formData, setFormData] = useState(createEmptyForm());

  useEffect(() => {
    fetchChannels();
  }, []);

  const fetchChannels = async () => {
    try {
      setLoadError('');
      setChannels(await getAllMarketplaceChannels());
    } catch (error) {
      console.error('Không thể tải danh sách kênh TMĐT:', error);
      setLoadError(error.message || 'Không thể tải danh sách kênh TMĐT.');
    } finally {
      setLoading(false);
    }
  };

  const sortedChannels = [...channels].sort(
    (a, b) => (Number(a.order) || 0) - (Number(b.order) || 0)
  );
  const activeCount = channels.filter((channel) => channel.isActive !== false).length;

  const openAddForm = () => {
    const lastOrder = sortedChannels.reduce(
      (maxOrder, channel) => Math.max(maxOrder, Number(channel.order) || 0),
      -1
    );
    setEditingChannel(null);
    setFormData(createEmptyForm(lastOrder + 1));
    setFormError('');
    setShowForm(true);
  };

  const openEditForm = (channel) => {
    setEditingChannel(channel);
    setFormData({
      name: channel.name || '',
      url: channel.url || '',
      order: Number(channel.order) || 0,
      isActive: channel.isActive !== false
    });
    setFormError('');
    setShowForm(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const name = formData.name.trim();
    const url = formData.url.trim();
    const order = Number(formData.order);

    if (!name) {
      setFormError('Vui lòng nhập tên kênh.');
      return;
    }
    if (!isExternalHttpUrl(url)) {
      setFormError('Liên kết phải là URL bắt đầu bằng http:// hoặc https://.');
      return;
    }
    if (!Number.isInteger(order) || order < 0) {
      setFormError('Thứ tự hiển thị phải là số nguyên không âm.');
      return;
    }

    setSaving(true);
    setFormError('');
    const channelData = { name, url, order, isActive: formData.isActive };
    try {
      if (editingChannel) {
        await updateMarketplaceChannel(editingChannel.id, channelData);
      } else {
        await createMarketplaceChannel(channelData);
      }
      setShowForm(false);
      await fetchChannels();
    } catch (error) {
      console.error('Không thể lưu kênh TMĐT:', error);
      setFormError(getMarketplaceErrorMessage(error, 'Lưu kênh thất bại. Vui lòng thử lại.'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (channel) => {
    try {
      await updateMarketplaceChannel(channel.id, { isActive: channel.isActive === false });
      setChannels((current) => current.map((item) => item.id === channel.id
        ? { ...item, isActive: channel.isActive === false }
        : item));
    } catch (error) {
      console.error('Không thể cập nhật trạng thái kênh:', error);
      alert(`Cập nhật trạng thái thất bại: ${getMarketplaceErrorMessage(error, 'Vui lòng thử lại.')}`);
    }
  };

  const handleDelete = async (channel) => {
    if (!window.confirm(`Bạn có chắc muốn xóa kênh "${channel.name}"?`)) return;
    try {
      await deleteMarketplaceChannel(channel.id);
      setChannels((current) => current.filter((item) => item.id !== channel.id));
    } catch (error) {
      console.error('Không thể xóa kênh TMĐT:', error);
      alert(`Xóa kênh thất bại: ${getMarketplaceErrorMessage(error, 'Vui lòng thử lại.')}`);
    }
  };

  return (
    <div className="marketplace-channels-container">
      <div className="marketplace-channels-page">
        <div className="marketplace-channels-heading">
          <div>
            <span className="marketplace-channels-eyebrow">KẾT NỐI BÁN HÀNG</span>
            <h2>Quản lý kênh TMĐT</h2>
            <p>Thêm liên kết đến các gian hàng để khách truy cập từ thanh điều hướng.</p>
          </div>
          <button type="button" className="marketplace-channels-add" onClick={openAddForm}>
            <span aria-hidden="true">＋</span>
            Thêm kênh
          </button>
        </div>

        <div className="marketplace-channels-summary">
          <span className="marketplace-channels-summary-icon" aria-hidden="true">🛍️</span>
          <div><small>Tổng số kênh</small><strong>{channels.length}</strong></div>
          <span className="marketplace-channels-summary-divider" />
          <span className="marketplace-channels-summary-icon active" aria-hidden="true">✓</span>
          <div><small>Đang hiển thị</small><strong>{activeCount}</strong></div>
          <span className="marketplace-channels-summary-note">
            Kênh đã ẩn sẽ không xuất hiện với khách hàng.
          </span>
        </div>

        {loading ? (
          <div className="marketplace-channels-state">
            <LoadingSpinner message="Đang tải kênh TMĐT..." inline />
          </div>
        ) : loadError ? (
          <div className="marketplace-channels-state error" role="alert">
            <strong>Không tải được danh sách kênh</strong>
            <p>{loadError}</p>
            <button type="button" onClick={() => { setLoading(true); fetchChannels(); }}>Thử lại</button>
          </div>
        ) : sortedChannels.length === 0 ? (
          <div className="marketplace-channels-state empty">
            <span aria-hidden="true">🛍️</span>
            <h3>Chưa có kênh TMĐT nào</h3>
            <p>Thêm liên kết gian hàng để khách hàng dễ dàng tìm thấy bạn trên các nền tảng.</p>
            <button type="button" className="marketplace-channels-add" onClick={openAddForm}>
              Thêm kênh đầu tiên
            </button>
          </div>
        ) : (
          <div className="marketplace-channels-list">
            {sortedChannels.map((channel, index) => (
              <article className="marketplace-channel-card" key={channel.id}>
                <div className="marketplace-channel-number">{index + 1}</div>
                <div className="marketplace-channel-info">
                  <div className="marketplace-channel-title">
                    <h3>{channel.name}</h3>
                    <span className={`marketplace-channel-status ${channel.isActive === false ? 'inactive' : ''}`}>
                      {channel.isActive === false ? 'Đã ẩn' : 'Đang hiển thị'}
                    </span>
                  </div>
                  <a href={channel.url} target="_blank" rel="noopener noreferrer">
                    {channel.url}
                    <span aria-hidden="true"> ↗</span>
                  </a>
                  <small>Thứ tự hiển thị: {Number(channel.order) || 0}</small>
                </div>
                <div className="marketplace-channel-actions">
                  <button type="button" onClick={() => openEditForm(channel)}>Chỉnh sửa</button>
                  <button type="button" onClick={() => handleToggleActive(channel)}>
                    {channel.isActive === false ? 'Hiển thị' : 'Ẩn'}
                  </button>
                  <button type="button" className="delete" onClick={() => handleDelete(channel)}>Xóa</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="marketplace-channel-modal-overlay">
          <section
            className="marketplace-channel-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="marketplace-channel-modal-title"
          >
            <div className="marketplace-channel-modal-header">
              <div>
                <span className="marketplace-channels-eyebrow">KẾT NỐI BÁN HÀNG</span>
                <h3 id="marketplace-channel-modal-title">
                  {editingChannel ? 'Chỉnh sửa kênh' : 'Thêm kênh mới'}
                </h3>
              </div>
              <button
                type="button"
                className="marketplace-channel-modal-close"
                onClick={() => setShowForm(false)}
                aria-label="Đóng"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="marketplace-channel-form">
                <label htmlFor="marketplace-channel-name">Tên kênh</label>
                <input
                  id="marketplace-channel-name"
                  type="text"
                  value={formData.name}
                  onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Ví dụ: Shopee, TikTok Shop, Website..."
                  maxLength={60}
                  required
                />

                <label htmlFor="marketplace-channel-url">Liên kết gian hàng</label>
                <input
                  id="marketplace-channel-url"
                  type="url"
                  value={formData.url}
                  onChange={(event) => setFormData((current) => ({ ...current, url: event.target.value }))}
                  placeholder="https://..."
                  maxLength={2048}
                  required
                />

                <label htmlFor="marketplace-channel-order">Thứ tự hiển thị</label>
                <input
                  id="marketplace-channel-order"
                  type="number"
                  min="0"
                  step="1"
                  value={formData.order}
                  onChange={(event) => setFormData((current) => ({ ...current, order: event.target.value }))}
                  required
                />

                <label className="marketplace-channel-checkbox">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(event) => setFormData((current) => ({ ...current, isActive: event.target.checked }))}
                  />
                  Hiển thị kênh trên website
                </label>

                {formError && <p className="marketplace-channel-form-error" role="alert">{formError}</p>}
              </div>
              <div className="marketplace-channel-form-actions">
                <button type="button" onClick={() => setShowForm(false)}>Hủy</button>
                <button type="submit" className="save" disabled={saving}>
                  {saving ? 'Đang lưu...' : 'Lưu kênh'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
};

export default MarketplaceChannels;
