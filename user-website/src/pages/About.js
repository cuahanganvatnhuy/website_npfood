import { useState, useEffect } from 'react';
import { getIntroduction } from '../services/dataService';
import '../css/About.css';

const About = () => {
  const [introduction, setIntroduction] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchIntroduction();
  }, []);

  const fetchIntroduction = async () => {
    try {
      const introData = await getIntroduction();
      setIntroduction(introData);
    } catch (error) {
      console.error('Error fetching introduction:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Đang tải...</div>;
  }

  if (!introduction) {
    return <div className="empty-state">Chưa có thông tin giới thiệu.</div>;
  }

  return (
    <div className="about-page">
      <div className="container">
        {/* Hero Section */}
        <div className="about-hero">
          {introduction.imageUrl && (
            <img src={introduction.imageUrl} alt="About" className="about-hero-image" />
          )}
          <div className="about-hero-content">
            <h1 className="about-title">{introduction.title}</h1>
          </div>
        </div>

        {/* Main Content */}
        <div className="about-content">
          <div className="about-section">
            <h2>Về Chúng Tôi</h2>
            <p className="about-text">{introduction.content}</p>
          </div>

          {introduction.mission && (
            <div className="about-section mission-section">
              <h2>Sứ Mệnh</h2>
              <p className="about-text">{introduction.mission}</p>
            </div>
          )}

          {introduction.vision && (
            <div className="about-section vision-section">
              <h2>Tầm Nhìn</h2>
              <p className="about-text">{introduction.vision}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default About;