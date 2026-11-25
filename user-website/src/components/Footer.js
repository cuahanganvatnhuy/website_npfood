import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getContactInfo } from '../services/dataService';
import '../css/Footer.css';

const Footer = () => {
  const [contactInfo, setContactInfo] = useState(null);

  useEffect(() => {
    getContactInfo()
      .then(setContactInfo)
      .catch((error) => console.error('Không thể tải thông tin cửa hàng:', error));
  }, []);

  return (
    <footer className="store-footer">
      <div className="store-footer-container">
        <div className="store-footer-main">
          <div className="store-footer-brand">
            <Link to="/" className="store-footer-logo">
              <img src="/logo.png" alt="" />
              <span>NP FOOD</span>
            </Link>
            <p>Sản phẩm chọn lọc, gửi trọn hương vị và sự chăm chút đến gia đình bạn.</p>
            <span className="store-footer-tagline">DINH DƯỠNG TRỌN VẸN</span>
          </div>
          <div className="store-footer-column">
            <h3>Khám phá</h3>
            <Link to="/products">Sản phẩm</Link>
            <Link to="/about">Về NP Food</Link>
            <Link to="/news">Tin tức</Link>
          </div>
          <div className="store-footer-column">
            <h3>Hỗ trợ khách hàng</h3>
            <Link to="/contact">Liên hệ cửa hàng</Link>
            <Link to="/cart">Giỏ hàng</Link>
            {(contactInfo?.workingHours || contactInfo?.hours) && <span>{contactInfo.workingHours || contactInfo.hours}</span>}
          </div>
          <div className="store-footer-column store-footer-contact">
            <h3>Thông tin liên hệ</h3>
            {contactInfo?.address && <span>📍 {contactInfo.address}</span>}
            {contactInfo?.phone && <a href={`tel:${contactInfo.phone}`}>📞 {contactInfo.phone}</a>}
            {contactInfo?.email && <a href={`mailto:${contactInfo.email}`}>✉ {contactInfo.email}</a>}
            {contactInfo?.zaloPhone && (
              <a href={`https://zalo.me/${contactInfo.zaloPhone}`} target="_blank" rel="noopener noreferrer">
                Zalo · {contactInfo.zaloPhone}
              </a>
            )}
          </div>
        </div>
        <div className="store-footer-bottom">
          <span>© {new Date().getFullYear()} NP Food. All rights reserved.</span>
          <span>Chăm chút từng lựa chọn của bạn.</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
