import React, { useState, useEffect } from 'react';
import { getContactInfo } from '../services/dataService';
import { FacebookBrandIcon, ZaloBrandIcon } from './SocialBrandIcons';
import './SocialIcons.css';

const SocialIcons = () => {
  const [contactInfo, setContactInfo] = useState(null);

  useEffect(() => {
    getContactInfo()
      .then(setContactInfo)
      .catch((error) => console.error('Không thể tải thông tin mạng xã hội:', error));
  }, []);

  if (!contactInfo?.zaloPhone && !contactInfo?.facebookPage) return null;

  return (
    <div className="social-icons">
      {contactInfo.zaloPhone && (
        <a
          href={`https://zalo.me/${contactInfo.zaloPhone}`}
          target="_blank"
          rel="noopener noreferrer"
          className="social-icon zalo-icon"
          title="Chat Zalo"
          aria-label="Chat với cửa hàng qua Zalo"
        >
          <ZaloBrandIcon className="social-icon-brand" />
        </a>
      )}
      {contactInfo.facebookPage && (
        <a
          href={contactInfo.facebookPage}
          target="_blank"
          rel="noopener noreferrer"
          className="social-icon facebook-icon"
          title="Facebook"
          aria-label="Trang Facebook của cửa hàng"
        >
          <FacebookBrandIcon className="social-icon-brand" />
        </a>
      )}
    </div>
  );
};

export default SocialIcons;
