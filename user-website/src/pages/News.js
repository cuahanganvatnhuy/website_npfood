import { useState, useEffect } from 'react';
import { getPublishedNews, getNewsById } from '../services/dataService';
import '../css/News.css';

const News = () => {
  const [news, setNews] = useState([]);
  const [selectedNews, setSelectedNews] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async () => {
    try {
      const newsData = await getPublishedNews();
      setNews(newsData);
    } catch (error) {
      console.error('Error fetching news:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNewsClick = async (newsItem) => {
    try {
      const detail = await getNewsById(newsItem.id);
      setSelectedNews(detail);
    } catch (error) {
      console.error('Error fetching news detail:', error);
    }
  };

  const handleBack = () => {
    setSelectedNews(null);
  };

  if (loading) {
    return <div className="loading">Đang tải...</div>;
  }

  if (selectedNews) {
    return (
      <div className="news-page">
        <div className="container">
          <button onClick={handleBack} className="back-button">
            ← Quay lại
          </button>
          <article className="news-detail">
            {selectedNews.imageUrl && (
              <img src={selectedNews.imageUrl} alt={selectedNews.title} className="news-detail-image" />
            )}
            <h1 className="news-detail-title">{selectedNews.title}</h1>
            <div className="news-detail-meta">
              <span className="news-author">✍️ {selectedNews.author}</span>
              <span className="news-date">
                📅 {new Date(selectedNews.createdAt).toLocaleDateString('vi-VN')}
              </span>
            </div>
            {selectedNews.summary && (
              <p className="news-detail-summary">{selectedNews.summary}</p>
            )}
            <div className="news-detail-content">
              {selectedNews.content}
            </div>
          </article>
        </div>
      </div>
    );
  }

  return (
    <div className="news-page">
      <div className="container">
        <h1 className="page-title">Tin Tức</h1>
        
        {news.length === 0 ? (
          <div className="empty-state">
            Chưa có tin tức nào.
          </div>
        ) : (
          <div className="news-grid">
            {news.map((item) => (
              <div 
                key={item.id} 
                className="news-card"
                onClick={() => handleNewsClick(item)}
              >
                {item.imageUrl && (
                  <img src={item.imageUrl} alt={item.title} className="news-image" />
                )}
                <div className="news-info">
                  <h3 className="news-title">{item.title}</h3>
                  {item.summary && (
                    <p className="news-summary">{item.summary}</p>
                  )}
                  <div className="news-meta">
                    <span className="news-author">✍️ {item.author}</span>
                    <span className="news-date">
                      📅 {new Date(item.createdAt).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default News;