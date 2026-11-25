import { useState, useEffect } from 'react';
import { getContactInfo, createContactMessage } from '../services/dataService';
import { FacebookBrandIcon, ZaloBrandIcon } from '../components/SocialBrandIcons';
import '../css/Contact.css';

const Contact = () => {
  const [contactInfo, setContactInfo] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchContactInfo();
  }, []);

  const fetchContactInfo = async () => {
    try {
      const info = await getContactInfo();
      console.log('Contact info loaded:', info);
      setContactInfo(info);
    } catch (error) {
      console.error('Error fetching contact info:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createContactMessage({ ...formData, type: 'contact' });
      setSuccess(true);
      setFormData({
        name: '',
        email: '',
        phone: '',
        message: ''
      });
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Gửi tin nhắn thất bại. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="loading">Đang tải...</div>;
  }

  return (
    <div className="contact-page">
      <div className="container">
        <div className="contact-brand" aria-label="NP Food - Dinh dưỡng trọn vẹn">
          <img src="/logo.png" alt="" />
          <div className="contact-brand-copy">
            <strong>NP FOOD</strong>
            <span>DINH DƯỠNG TRỌN VẸN</span>
          </div>
        </div>
        <h1 className="page-title">Liên hệ NP Food</h1>
        
        <div className="contact-content">
          {/* Contact Information */}
          <div className="contact-info">
            <h2>Thông tin cửa hàng</h2>
            {contactInfo ? (
              <div className="contact-details">
                {contactInfo.address && (
                  <div className="contact-item">
                    <span className="contact-icon">📍</span>
                    <span>{contactInfo.address}</span>
                  </div>
                )}
                {contactInfo.phone && (
                  <a className="contact-item contact-item-link" href={`tel:${contactInfo.phone}`}>
                    <span className="contact-icon">📞</span>
                    <span>{contactInfo.phone}</span>
                  </a>
                )}
                {contactInfo.email && (
                  <a className="contact-item contact-item-link" href={`mailto:${contactInfo.email}`}>
                    <span className="contact-icon">✉️</span>
                    <span>{contactInfo.email}</span>
                  </a>
                )}
                {(contactInfo.workingHours || contactInfo.hours) && (
                  <div className="contact-item">
                    <span className="contact-icon">🕐</span>
                    <span>{contactInfo.workingHours || contactInfo.hours}</span>
                  </div>
                )}
                {contactInfo.mapUrl && (
                  <a className="contact-item contact-item-link" href={contactInfo.mapUrl} target="_blank" rel="noopener noreferrer">
                    <span className="contact-icon">🗺️</span>
                    <span>Xem vị trí cửa hàng trên bản đồ</span>
                  </a>
                )}
                
                {/* Social Media Links */}
                <div className="social-links">
                  {contactInfo.zaloPhone && (
                    <a
                      href={`https://zalo.me/${contactInfo.zaloPhone}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="social-link zalo-link"
                    >
                      <ZaloBrandIcon className="social-brand-icon" />
                      <span>Zalo: {contactInfo.zaloPhone}</span>
                    </a>
                  )}
                  {contactInfo.facebookPage && (
                    <a
                      href={contactInfo.facebookPage}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="social-link facebook-link"
                    >
                      <FacebookBrandIcon className="social-brand-icon" />
                      <span>Facebook</span>
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <p className="no-info">Chưa có thông tin liên hệ.</p>
            )}
          </div>

          {/* Contact Form */}
          <div className="contact-form-wrapper">
            <h2>Gửi tin nhắn cho cửa hàng</h2>
            {success && (
              <div className="success-message">
                ✓ Tin nhắn đã được gửi thành công!
              </div>
            )}
            <form onSubmit={handleSubmit} className="contact-form">
              <div className="form-group">
                <label>Họ và Tên</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Số Điện Thoại</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Tin Nhắn</label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  rows={5}
                  required
                />
              </div>
              <button 
                type="submit" 
                className="submit-button"
                disabled={submitting}
              >
                {submitting ? 'Đang gửi...' : 'Gửi Tin Nhắn'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contact;