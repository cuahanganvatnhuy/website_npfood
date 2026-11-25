import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getContactInfo, saveContactInfo } from '../services/pageService.js';
import LoadingSpinner from '../components/LoadingSpinner.js';
import '../css/Contact.css';

const emptyContactInfo = {
  address: '',
  phone: '',
  email: '',
  workingHours: '',
  mapUrl: '',
  zaloPhone: '',
  facebookPage: ''
};

const Contact = () => {
  const [contactInfo, setContactInfo] = useState(emptyContactInfo);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchContactInfo();
  }, []);

  const fetchContactInfo = async () => {
    try {
      setLoadError('');
      const info = await getContactInfo();
      if (info) {
        setContactInfo({
          address: info.address || '',
          phone: info.phone || '',
          email: info.email || '',
          workingHours: info.workingHours || '',
          mapUrl: info.mapUrl || '',
          zaloPhone: info.zaloPhone || '',
          facebookPage: info.facebookPage || ''
        });
      }
    } catch (error) {
      console.error('Lỗi khi tải thông tin liên hệ:', error);
      setLoadError(error.message || 'Không thể tải thông tin liên hệ.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveContactInfo = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await saveContactInfo(contactInfo);
      alert('Lưu thông tin liên hệ thành công!');
    } catch (error) {
      console.error('Lỗi khi lưu thông tin liên hệ:', error);
      alert('Lưu thông tin liên hệ thất bại: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field, value) => {
    setContactInfo((current) => ({ ...current, [field]: value }));
  };

  return (
    <div className="store-contact-container">
      <div className="store-contact-page">
        <div className="store-contact-heading">
          <div>
            <span className="store-contact-eyebrow">THÔNG TIN CỬA HÀNG</span>
            <h2>Liên hệ cửa hàng</h2>
            <p>Cập nhật thông tin để khách hàng dễ dàng kết nối và tìm đến cửa hàng.</p>
          </div>
          <button type="button" className="store-contact-inbox-link" onClick={() => navigate('/contact-messages')}>
            <span aria-hidden="true">✉</span>
            Hộp thư tin nhắn
          </button>
        </div>

        {loading ? (
          <div className="store-contact-state">
            <LoadingSpinner message="Đang tải thông tin liên hệ..." inline />
          </div>
        ) : loadError ? (
          <div className="store-contact-error" role="alert">
            <strong>Không tải được thông tin cửa hàng</strong>
            <p>{loadError}</p>
            <button type="button" onClick={() => { setLoading(true); fetchContactInfo(); }}>Thử lại</button>
          </div>
        ) : (
          <div className="store-contact-layout">
            <section className="store-contact-card">
              <div className="store-contact-card-header">
                <div>
                  <h3>Thông tin hiển thị</h3>
                  <p>Khách hàng có thể xem các thông tin này trên website.</p>
                </div>
                <span className="store-contact-card-icon">⌖</span>
              </div>
              <form onSubmit={handleSaveContactInfo}>
                <div className="store-contact-form">
                  <div className="store-contact-field full">
                    <label htmlFor="store-address">Địa chỉ cửa hàng</label>
                    <input id="store-address" type="text" value={contactInfo.address} onChange={(event) => updateField('address', event.target.value)} placeholder="Số nhà, đường, quận/huyện, tỉnh/thành phố" />
                  </div>
                  <div className="store-contact-field">
                    <label htmlFor="store-phone">Điện thoại</label>
                    <input id="store-phone" type="tel" value={contactInfo.phone} onChange={(event) => updateField('phone', event.target.value)} placeholder="Ví dụ: 0901 234 567" />
                  </div>
                  <div className="store-contact-field">
                    <label htmlFor="store-email">Email</label>
                    <input id="store-email" type="email" value={contactInfo.email} onChange={(event) => updateField('email', event.target.value)} placeholder="hello@cuahang.vn" />
                  </div>
                  <div className="store-contact-field full">
                    <label htmlFor="store-hours">Giờ mở cửa</label>
                    <input id="store-hours" type="text" value={contactInfo.workingHours} onChange={(event) => updateField('workingHours', event.target.value)} placeholder="Ví dụ: Thứ 2 - Chủ nhật, 8:00 - 21:00" />
                  </div>
                  <div className="store-contact-field full">
                    <label htmlFor="store-map">Liên kết Google Maps</label>
                    <input id="store-map" type="url" value={contactInfo.mapUrl} onChange={(event) => updateField('mapUrl', event.target.value)} placeholder="https://maps.google.com/..." />
                  </div>
                  <div className="store-contact-field">
                    <label htmlFor="store-zalo">Số Zalo</label>
                    <input id="store-zalo" type="tel" value={contactInfo.zaloPhone} onChange={(event) => updateField('zaloPhone', event.target.value)} placeholder="Số điện thoại Zalo" />
                  </div>
                  <div className="store-contact-field">
                    <label htmlFor="store-facebook">Facebook cửa hàng</label>
                    <input id="store-facebook" type="url" value={contactInfo.facebookPage} onChange={(event) => updateField('facebookPage', event.target.value)} placeholder="https://facebook.com/..." />
                  </div>
                </div>
                <div className="store-contact-form-actions">
                  <button type="button" className="store-contact-cancel" onClick={() => navigate('/dashboard')}>Hủy</button>
                  <button type="submit" className="store-contact-save" disabled={saving}>
                    {saving ? 'Đang lưu...' : 'Lưu thông tin'}
                  </button>
                </div>
              </form>
            </section>

            <aside className="store-contact-preview">
              <div className="store-contact-card-header">
                <div>
                  <h3>Thông tin cửa hàng</h3>
                  <p>Bản xem trước liên hệ.</p>
                </div>
                <span className="store-contact-preview-tag">PREVIEW</span>
              </div>
              <div className="store-contact-preview-body">
                <div className="store-contact-preview-mark">NP</div>
                <h3>NP Food</h3>
                <p className="store-contact-preview-caption">Luôn sẵn sàng hỗ trợ bạn</p>
                <div className="store-contact-preview-list">
                  <div><span>ĐỊA CHỈ</span><p>{contactInfo.address || 'Chưa cập nhật địa chỉ'}</p></div>
                  <div><span>ĐIỆN THOẠI</span><p>{contactInfo.phone || 'Chưa cập nhật số điện thoại'}</p></div>
                  <div><span>EMAIL</span><p>{contactInfo.email || 'Chưa cập nhật email'}</p></div>
                  <div><span>GIỜ MỞ CỬA</span><p>{contactInfo.workingHours || 'Chưa cập nhật giờ mở cửa'}</p></div>
                </div>
                <div className="store-contact-socials">
                  {contactInfo.zaloPhone && <span>Zalo · {contactInfo.zaloPhone}</span>}
                  {contactInfo.facebookPage && <a href={contactInfo.facebookPage} target="_blank" rel="noopener noreferrer">Facebook ↗</a>}
                  {contactInfo.mapUrl && <a href={contactInfo.mapUrl} target="_blank" rel="noopener noreferrer">Xem bản đồ ↗</a>}
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
};

export default Contact;
