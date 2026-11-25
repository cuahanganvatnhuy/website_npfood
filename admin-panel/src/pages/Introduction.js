import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getIntroduction, saveIntroduction } from '../services/pageService.js';
import LoadingSpinner from '../components/LoadingSpinner.js';
import '../css/Introduction.css';

const Introduction = () => {
  const [introduction, setIntroduction] = useState({
    title: '',
    content: '',
    mission: '',
    vision: '',
    imageUrl: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchIntroduction();
  }, []);

  const fetchIntroduction = async () => {
    try {
      setLoadError('');
      const introData = await getIntroduction();
      if (introData) setIntroduction(introData);
    } catch (error) {
      console.error('Lỗi khi tải giới thiệu:', error);
      setLoadError(error.message || 'Không thể tải nội dung giới thiệu.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await saveIntroduction(introduction);
      alert('Lưu trang giới thiệu thành công!');
    } catch (error) {
      console.error('Lỗi khi lưu giới thiệu:', error);
      alert('Lưu trang giới thiệu thất bại: ' + error.message);
    } finally {
      setSaving(false);
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
        setIntroduction((current) => ({ ...current, imageUrl: reader.result }));
      }
    };
    reader.onerror = () => alert('Không thể đọc tệp hình ảnh.');
    reader.readAsDataURL(file);
  };

  return (
    <div className="introduction-container">
      <div className="introduction-page">
        <div className="introduction-heading">
          <div>
            <span className="page-eyebrow">NỘI DUNG CỬA HÀNG</span>
            <h2>Giới thiệu cửa hàng</h2>
            <p>Chia sẻ câu chuyện và giá trị của cửa hàng với khách hàng.</p>
          </div>
        </div>

        {loading ? (
          <div className="introduction-loading">
            <LoadingSpinner message="Đang tải nội dung..." inline />
          </div>
        ) : loadError ? (
          <div className="introduction-load-error" role="alert">
            <strong>Không tải được nội dung giới thiệu</strong>
            <p>{loadError}</p>
            <button type="button" onClick={() => { setLoading(true); fetchIntroduction(); }}>Thử lại</button>
          </div>
        ) : (
          <div className="introduction-layout">
            <section className="introduction-editor">
              <div className="introduction-card-header">
                <div>
                  <h3>Nội dung giới thiệu</h3>
                  <p>Cập nhật thông tin hiển thị trên trang cửa hàng.</p>
                </div>
                <span className="introduction-card-icon">✎</span>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="introduction-form">
                  <div className="introduction-field">
                    <label htmlFor="intro-title">Tiêu đề</label>
                    <input
                      id="intro-title"
                      type="text"
                      value={introduction.title || ''}
                      onChange={(event) => setIntroduction({ ...introduction, title: event.target.value })}
                      placeholder="Ví dụ: Câu chuyện NP Food"
                      required
                    />
                  </div>

                  <div className="introduction-field">
                    <label htmlFor="intro-content">Nội dung chính</label>
                    <textarea
                      id="intro-content"
                      value={introduction.content || ''}
                      onChange={(event) => setIntroduction({ ...introduction, content: event.target.value })}
                      rows={5}
                      placeholder="Giới thiệu về cửa hàng và sản phẩm..."
                      required
                    />
                  </div>

                  <div className="introduction-field">
                    <label htmlFor="intro-mission">Sứ mệnh</label>
                    <textarea
                      id="intro-mission"
                      value={introduction.mission || ''}
                      onChange={(event) => setIntroduction({ ...introduction, mission: event.target.value })}
                      rows={3}
                      placeholder="Giá trị cửa hàng mang đến cho khách hàng..."
                    />
                  </div>

                  <div className="introduction-field">
                    <label htmlFor="intro-vision">Tầm nhìn</label>
                    <textarea
                      id="intro-vision"
                      value={introduction.vision || ''}
                      onChange={(event) => setIntroduction({ ...introduction, vision: event.target.value })}
                      rows={3}
                      placeholder="Định hướng phát triển của cửa hàng..."
                    />
                  </div>

                  <div className="introduction-field">
                    <label>Ảnh giới thiệu</label>
                    <div className="introduction-image-picker">
                      <input id="intro-image" type="file" accept="image/*" onChange={handleImageUpload} />
                      <label htmlFor="intro-image">
                        <span>＋</span>
                        <strong>Chọn hình ảnh</strong>
                        <small>Định dạng hình ảnh phổ biến</small>
                      </label>
                      {introduction.imageUrl && (
                        <div className="introduction-image-preview">
                          <img src={introduction.imageUrl} alt="Ảnh giới thiệu cửa hàng" />
                          <button
                            type="button"
                            onClick={() => setIntroduction({ ...introduction, imageUrl: '' })}
                            aria-label="Xóa ảnh giới thiệu"
                          >
                            ×
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="introduction-form-actions">
                  <button type="button" className="introduction-cancel" onClick={() => navigate('/dashboard')}>Hủy</button>
                  <button type="submit" className="introduction-save" disabled={saving}>
                    {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </button>
                </div>
              </form>
            </section>

            <aside className="introduction-preview">
              <div className="introduction-card-header">
                <div>
                  <h3>Xem trước</h3>
                  <p>Bản xem trước nội dung cửa hàng.</p>
                </div>
                <span className="introduction-preview-label">PREVIEW</span>
              </div>
              <div className="introduction-preview-body">
                {introduction.imageUrl && (
                  <img className="introduction-preview-image" src={introduction.imageUrl} alt="" />
                )}
                <span className="preview-kicker">VỀ CHÚNG TÔI</span>
                <h2>{introduction.title || 'Tiêu đề cửa hàng'}</h2>
                <p className="introduction-preview-content">{introduction.content || 'Nội dung giới thiệu sẽ hiển thị tại đây.'}</p>
                {introduction.mission && (
                  <div className="introduction-value-card mission">
                    <span>01</span>
                    <div><h4>Sứ mệnh</h4><p>{introduction.mission}</p></div>
                  </div>
                )}
                {introduction.vision && (
                  <div className="introduction-value-card vision">
                    <span>02</span>
                    <div><h4>Tầm nhìn</h4><p>{introduction.vision}</p></div>
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
};

export default Introduction;
