import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getNewsById } from '../services/dataService';
import '../css/News.css';

const NewsDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [news, setNews] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNewsDetail();
  }, [id]);

  const fetchNewsDetail = async () => {
    try {
      const newsData = await getNewsById(id);
      setNews(newsData);
    } catch (error) {
      console.error('Error fetching news detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/news');
  };

  if (loading) {
    return <div className="loading">Đang tải...</div>;
  }

  if (!news) {
    return (
      <div className="news-page">
        <div className="container">
          <button onClick={handleBack} className="back-button">
            ← Quay lại
          </button>
          <div className="empty-state">
            Không tìm thấy tin tức.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="news-page">
      <div className="container">
        <button onClick={handleBack} className="back-button">
          ← Quay lại
        </button>
        <article className="news-detail">
          {news.imageUrl && (
            <img src={news.imageUrl} alt={news.title} className="news-detail-image" />
          )}
          <h1 className="news-detail-title">{news.title}</h1>
          <div className="news-detail-meta">
            <span className="news-author">✍️ {news.author}</span>
            <span className="news-date">
              📅 {new Date(news.createdAt).toLocaleDateString('vi-VN')}
            </span>
          </div>
          {news.summary && (
            <p className="news-detail-summary">{news.summary}</p>
          )}
          <div className="news-detail-content">
            {news.content}
          </div>
        </article>
      </div>
    </div>
  );
};

export default NewsDetail;
