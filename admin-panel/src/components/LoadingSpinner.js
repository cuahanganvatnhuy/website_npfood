import React from 'react';
import '../css/LoadingSpinner.css';

const LoadingSpinner = ({ message = 'Đang tải...', inline = false }) => {
  if (inline) {
    return (
      <div className="data-loading-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p className="loading-message">{message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="loading-overlay">
      <div className="loading-spinner">
        <div className="spinner"></div>
        <p className="loading-message">{message}</p>
      </div>
    </div>
  );
};

export default LoadingSpinner;
