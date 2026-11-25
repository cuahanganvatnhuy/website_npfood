import { useState, useEffect, useMemo } from 'react';
import { getAllNews, createNews, updateNews, deleteNews } from '../services/pageService.js';
import LoadingSpinner from '../components/LoadingSpinner.js';
import '../css/News.css';

const emptyForm = {
  title: '',
  content: '',
  summary: '',
  imageUrl: '',
  author: 'Admin',
  published: true
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('vi-VN');
};

const News = () => {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingNews, setEditingNews] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async () => {
    try {
      setLoadError('');
      setNews(await getAllNews());
    } catch (error) {
      console.error('Lỗi khi tải tin tức:', error);
      setLoadError(error.message || 'Không thể tải danh sách tin tức.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddNews = () => {
    setEditingNews(null);
    setFormData({ ...emptyForm });
    setShowModal(true);
  };

  const handleEditNews = (newsItem) => {
    setEditingNews(newsItem);
    setFormData({
      title: newsItem.title || '',
      content: newsItem.content || '',
      summary: newsItem.summary || '',
      imageUrl: newsItem.imageUrl || '',
      author: newsItem.author || 'Admin',
      published: newsItem.published !== false
    });
    setShowModal(true);
  };

  const handleDeleteNews = async (newsId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa bài viết này?')) return;
    try {
      await deleteNews(newsId);
      await fetchNews();
    } catch (error) {
      console.error('Lỗi khi xóa tin tức:', error);
      alert('Xóa tin tức thất bại: ' + error.message);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (editingNews) {
        await updateNews(editingNews.id, formData);
      } else {
        await createNews(formData);
      }
      setShowModal(false);
      await fetchNews();
    } catch (error) {
      console.error('Lỗi khi lưu tin tức:', error);
      alert('Lưu tin tức thất bại: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublished = async (newsItem) => {
    try {
      await updateNews(newsItem.id, { published: !newsItem.published });
      await fetchNews();
    } catch (error) {
      console.error('Lỗi khi cập nhật trạng thái bài viết:', error);
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

  const filteredNews = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase();
    return news.filter((item) => {
      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'published' ? item.published !== false : item.published === false);
      const matchesSearch = !query ||
        [item.title, item.summary, item.content, item.author]
          .some((value) => String(value || '').toLocaleLowerCase().includes(query));
      return matchesStatus && matchesSearch;
    });
  }, [news, searchTerm, statusFilter]);

  const publishedCount = news.filter((item) => item.published !== false).length;
  const draftCount = news.length - publishedCount;

  return (
    <div className="news-container">
      <div className="news-page">
        <div className="news-page-heading">
          <div>
            <span className="news-eyebrow">NỘI DUNG CỬA HÀNG</span>
            <h2>Tin tức & bài viết</h2>
            <p>Chia sẻ tin mới, câu chuyện và thông tin hữu ích với khách hàng.</p>
          </div>
          <div className="news-summary">
            <span><small>Tổng bài viết</small><strong>{news.length}</strong></span>
            <span className="news-summary-divider" />
            <span><small>Đang hiển thị</small><strong>{publishedCount}</strong></span>
            <span className="news-summary-draft"><small>Bản nháp</small><strong>{draftCount}</strong></span>
          </div>
        </div>

        <section className="news-card">
          <div className="news-card-header">
            <div>
              <h3>Danh sách bài viết</h3>
              <p>{filteredNews.length} bài viết</p>
            </div>
            <div className="news-toolbar">
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Tìm tiêu đề, nội dung..."
                className="news-search"
                aria-label="Tìm bài viết"
              />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="news-filter"
                aria-label="Lọc trạng thái bài viết"
              >
                <option value="all">Tất cả bài viết</option>
                <option value="published">Đang hiển thị</option>
                <option value="draft">Bản nháp</option>
              </select>
              <button type="button" onClick={handleAddNews} className="news-add-button">
                <span aria-hidden="true">＋</span>
                Thêm bài viết
              </button>
            </div>
          </div>

          {loading ? (
            <div className="news-message">
              <LoadingSpinner message="Đang tải tin tức..." inline />
            </div>
          ) : loadError ? (
            <div className="news-message news-load-error" role="alert">
              <strong>Không tải được danh sách bài viết</strong>
              <p>{loadError}</p>
              <button type="button" className="news-add-button" onClick={() => { setLoading(true); fetchNews(); }}>Thử lại</button>
            </div>
          ) : filteredNews.length === 0 ? (
            <div className="news-message news-empty">
              <span aria-hidden="true">📰</span>
              <strong>{news.length === 0 ? 'Chưa có bài viết' : 'Không tìm thấy bài viết'}</strong>
              <p>{news.length === 0 ? 'Tạo bài viết đầu tiên để cập nhật tin tức cho cửa hàng.' : 'Thử từ khóa hoặc bộ lọc khác.'}</p>
              {news.length === 0 && <button type="button" className="news-add-button" onClick={handleAddNews}>Thêm bài viết</button>}
            </div>
          ) : (
            <div className="news-table-scroll">
              <table className="news-table">
                <thead>
                  <tr>
                    <th>Bài viết</th>
                    <th>Tác giả</th>
                    <th>Ngày tạo</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredNews.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="news-article-cell">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt="" className="news-thumbnail" />
                          ) : (
                            <span className="news-thumbnail news-thumbnail-empty">📰</span>
                          )}
                          <div className="news-article-info">
                            <strong>{item.title || 'Chưa có tiêu đề'}</strong>
                            <span>{item.summary || item.content || 'Chưa có phần tóm tắt'}</span>
                          </div>
                        </div>
                      </td>
                      <td>{item.author || 'Admin'}</td>
                      <td>{formatDate(item.createdAt)}</td>
                      <td>
                        <span className={`news-status ${item.published === false ? 'draft' : 'published'}`}>
                          <span />
                          {item.published === false ? 'Bản nháp' : 'Đang hiển thị'}
                        </span>
                      </td>
                      <td>
                        <div className="news-actions">
                          <button type="button" onClick={() => handleEditNews(item)} className="news-action edit">Sửa</button>
                          <button type="button" onClick={() => handleTogglePublished(item)} className="news-action toggle">
                            {item.published === false ? 'Đăng' : 'Ẩn'}
                          </button>
                          <button type="button" onClick={() => handleDeleteNews(item.id)} className="news-action delete">Xóa</button>
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
        <div className="news-modal-overlay">
          <div className="news-modal" role="dialog" aria-modal="true" aria-labelledby="news-modal-title">
            <div className="news-modal-header">
              <div>
                <span className="news-eyebrow">NỘI DUNG CỬA HÀNG</span>
                <h3 id="news-modal-title">{editingNews ? 'Chỉnh sửa bài viết' : 'Tạo bài viết mới'}</h3>
              </div>
              <button type="button" onClick={() => setShowModal(false)} className="news-modal-close" aria-label="Đóng">×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="news-modal-body">
                <div className="news-form-group">
                  <label htmlFor="news-title">Tiêu đề</label>
                  <input id="news-title" value={formData.title} onChange={(event) => setFormData({ ...formData, title: event.target.value })} className="news-form-input" required />
                </div>
                <div className="news-form-group">
                  <label htmlFor="news-summary">Tóm tắt</label>
                  <textarea id="news-summary" value={formData.summary} onChange={(event) => setFormData({ ...formData, summary: event.target.value })} className="news-form-input news-textarea" rows={2} placeholder="Mô tả ngắn về bài viết..." />
                </div>
                <div className="news-form-group">
                  <label htmlFor="news-content">Nội dung</label>
                  <textarea id="news-content" value={formData.content} onChange={(event) => setFormData({ ...formData, content: event.target.value })} className="news-form-input news-textarea" rows={7} required />
                </div>
                <div className="news-form-group">
                  <label htmlFor="news-author">Tác giả</label>
                  <input id="news-author" value={formData.author} onChange={(event) => setFormData({ ...formData, author: event.target.value })} className="news-form-input" required />
                </div>
                <div className="news-form-group">
                  <label htmlFor="news-image">Ảnh bài viết</label>
                  <input id="news-image" type="file" accept="image/*" onChange={handleImageUpload} className="news-file-input" />
                  <div className="news-image-picker">
                    <label htmlFor="news-image" className="news-image-add">
                      <span>＋</span>
                      <small>{formData.imageUrl ? 'Đổi ảnh' : 'Chọn ảnh'}</small>
                    </label>
                    {formData.imageUrl && (
                      <div className="news-image-preview">
                        <img src={formData.imageUrl} alt="Xem trước ảnh bài viết" />
                        <button type="button" onClick={() => setFormData({ ...formData, imageUrl: '' })} aria-label="Xóa ảnh">×</button>
                      </div>
                    )}
                  </div>
                </div>
                <label className="news-publish-toggle">
                  <input type="checkbox" checked={formData.published} onChange={(event) => setFormData({ ...formData, published: event.target.checked })} />
                  <span>Hiển thị bài viết sau khi lưu</span>
                </label>
              </div>
              <div className="news-modal-footer">
                <button type="button" onClick={() => setShowModal(false)} className="news-cancel-button">Hủy</button>
                <button type="submit" className="news-save-button" disabled={saving}>
                  {saving ? 'Đang lưu...' : editingNews ? 'Lưu thay đổi' : 'Tạo bài viết'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default News;
