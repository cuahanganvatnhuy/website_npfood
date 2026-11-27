import React, { useState, useEffect } from 'react';
import { getContactInfo } from '../services/dataService';
import { FacebookBrandIcon, ZaloBrandIcon } from './SocialBrandIcons';
import './SocialIcons.css';

const SocialIcons = ({ onOpenChat }) => {
  const [contactInfo, setContactInfo] = useState(null);

  useEffect(() => {
    getContactInfo()
      .then(setContactInfo)
      .catch((error) => console.error('Không thể tải thông tin mạng xã hội:', error));
  }, []);

  if (!contactInfo?.zaloPhone && !contactInfo?.facebookPage && !onOpenChat) return null;

  return (
    <div className="social-icons">
      {onOpenChat && (
        <button
          type="button"
          className="social-icon chat-icon"
          onClick={onOpenChat}
          title="Nhắn tin với shop"
          aria-label="Nhắn tin với cửa hàng"
        >
          <svg className="social-icon-brand" viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <path d="M24 5C13.5 5 5 12.2 5 21.1c0 5 2.8 9.5 7.2 12.4l-1.6 8.2 8-4.2c1.7.5 3.5.7 5.4.7 10.5 0 19-7.2 19-16.1S34.5 5 24 5Z" fill="white" />
            <path d="M14 20h20M14 26h13" stroke="#07834b" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </button>
      )}
      {contactInfo?.zaloPhone && (
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
      {contactInfo?.facebookPage && (
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
