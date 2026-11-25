import { useState, useEffect, useMemo } from 'react';
import { getAllContactMessages, markMessageAsRead, markMessageAsUnread, deleteContactMessage } from '../services/pageService.js';
import LoadingSpinner from '../components/LoadingSpinner.js';
import '../css/ContactMessages.css';

const formatDateTime = (value) => {
  if (!value) return 'Chưa rõ thời gian';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Chưa rõ thời gian' : date.toLocaleString('vi-VN');
};

const getMessageType = (type) => {
  if (type === 'product_inquiry') return 'Hỏi sản phẩm';
  if (type === 'order_request') return 'Đơn hàng';
  return 'Liên hệ';
};

const ContactMessages = () => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    try {
      setLoadError('');
      setMessages(await getAllContactMessages());
    } catch (error) {
      console.error('Lỗi khi tải tin nhắn:', error);
      setLoadError(error.message || 'Không thể tải hộp thư.');
    } finally {
      setLoading(false);
    }
  };

  const filteredMessages = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase();
    return messages.filter((message) => {
      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'unread' ? !message.read : Boolean(message.read));
      const matchesQuery = !query ||
        [message.name, message.email, message.phone, message.message, message.productName, message.productTitle, message.courseTitle]
          .some((value) => String(value || '').toLocaleLowerCase().includes(query));
      return matchesStatus && matchesQuery;
    });
  }, [messages, searchTerm, statusFilter]);

  const selectedMessage = filteredMessages.find((message) => message.id === selectedId) || filteredMessages[0] || null;
  const unreadCount = messages.filter((message) => !message.read).length;

  const handleToggleRead = async (message) => {
    const nextRead = !message.read;
    try {
      if (nextRead) {
        await markMessageAsRead(message.id);
      } else {
        await markMessageAsUnread(message.id);
      }
      setMessages((current) => current.map((item) => item.id === message.id ? { ...item, read: nextRead } : item));
    } catch (error) {
      console.error('Lỗi khi cập nhật trạng thái đã đọc:', error);
      alert('Không thể cập nhật trạng thái tin nhắn: ' + error.message);
    }
  };

  const handleDeleteMessage = async (message) => {
    if (!window.confirm(`Xóa tin nhắn từ ${message.name || 'khách hàng'}?`)) return;
    try {
      await deleteContactMessage(message.id);
      setMessages((current) => current.filter((item) => item.id !== message.id));
      setSelectedId(null);
    } catch (error) {
      console.error('Lỗi khi xóa tin nhắn:', error);
      alert('Xóa tin nhắn thất bại: ' + error.message);
    }
  };

  return (
    <div className="contact-messages-container">
      <div className="contact-messages-page">
        <div className="contact-messages-heading">
          <div>
            <span className="contact-messages-eyebrow">CHĂM SÓC KHÁCH HÀNG</span>
            <h2>Tin nhắn đến</h2>
            <p>Xem và xử lý các câu hỏi từ khách hàng tại một nơi.</p>
          </div>
          <div className="contact-messages-count">
            <span className="contact-messages-count-icon">✉</span>
            <div><small>Tin chưa đọc</small><strong>{unreadCount}</strong></div>
          </div>
        </div>

        {loading ? (
          <div className="contact-messages-state">
            <LoadingSpinner message="Đang tải tin nhắn..." inline />
          </div>
        ) : loadError ? (
          <div className="contact-messages-error" role="alert">
            <strong>Không tải được hộp thư</strong>
            <p>{loadError}</p>
            <button type="button" onClick={() => { setLoading(true); fetchMessages(); }}>Thử lại</button>
          </div>
        ) : (
          <section className="contact-inbox">
            <div className="contact-inbox-toolbar">
              <div className="contact-inbox-filters" role="tablist" aria-label="Lọc tin nhắn">
                <button type="button" role="tab" aria-selected={statusFilter === 'all'} className={statusFilter === 'all' ? 'active' : ''} onClick={() => setStatusFilter('all')}>
                  Tất cả <span>{messages.length}</span>
                </button>
                <button type="button" role="tab" aria-selected={statusFilter === 'unread'} className={statusFilter === 'unread' ? 'active' : ''} onClick={() => setStatusFilter('unread')}>
                  Chưa đọc <span>{unreadCount}</span>
                </button>
                <button type="button" role="tab" aria-selected={statusFilter === 'read'} className={statusFilter === 'read' ? 'active' : ''} onClick={() => setStatusFilter('read')}>
                  Đã đọc <span>{messages.length - unreadCount}</span>
                </button>
              </div>
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="contact-inbox-search"
                placeholder="Tìm tên, email, nội dung..."
                aria-label="Tìm tin nhắn"
              />
            </div>

            <div className="contact-inbox-layout">
              <div className="contact-inbox-list" aria-label="Danh sách tin nhắn">
                {filteredMessages.length === 0 ? (
                  <div className="contact-inbox-empty">
                    <span>✉</span>
                    <strong>{messages.length === 0 ? 'Hộp thư đang trống' : 'Không tìm thấy tin nhắn'}</strong>
                    <p>{messages.length === 0 ? 'Tin nhắn khách hàng gửi đến sẽ xuất hiện tại đây.' : 'Thử từ khóa hoặc bộ lọc khác.'}</p>
                  </div>
                ) : filteredMessages.map((message) => {
                  const isSelected = selectedMessage?.id === message.id;
                  return (
                    <button
                      type="button"
                      key={message.id}
                      className={`contact-message-item ${!message.read ? 'unread' : ''} ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedId(message.id)}
                      aria-current={isSelected ? 'true' : undefined}
                    >
                      <span className="contact-message-avatar">{(message.name || 'K').trim().charAt(0).toLocaleUpperCase()}</span>
                      <span className="contact-message-list-content">
                        <span className="contact-message-list-top">
                          <strong>{message.name || 'Khách hàng'}</strong>
                          <time>{formatDateTime(message.createdAt)}</time>
                        </span>
                        <span className="contact-message-list-subject">
                          {message.productName || message.productTitle || message.courseTitle || getMessageType(message.type)}
                        </span>
                        <span className="contact-message-list-preview">{message.message || 'Không có nội dung'}</span>
                      </span>
                      {!message.read && <span className="contact-message-unread-dot" aria-label="Chưa đọc" />}
                    </button>
                  );
                })}
              </div>

              {selectedMessage ? (
                <article className="contact-message-detail">
                  <div className="contact-message-detail-header">
                    <div>
                      <span className={`contact-message-type ${selectedMessage.type === 'product_inquiry' || selectedMessage.type === 'order_request' ? 'commerce' : ''}`}>
                        {getMessageType(selectedMessage.type)}
                      </span>
                      <h3>{selectedMessage.name || 'Khách hàng'}</h3>
                      <p>Gửi lúc {formatDateTime(selectedMessage.createdAt)}</p>
                    </div>
                    {!selectedMessage.read && <span className="contact-message-new">MỚI</span>}
                  </div>

                  <div className="contact-message-contact">
                    {selectedMessage.email && <a href={`mailto:${selectedMessage.email}`}>{selectedMessage.email}</a>}
                    {selectedMessage.phone && <a href={`tel:${selectedMessage.phone}`}>{selectedMessage.phone}</a>}
                  </div>

                  {(selectedMessage.productName || selectedMessage.productTitle || selectedMessage.courseTitle || selectedMessage.orderId) && (
                    <div className="contact-message-context">
                      {selectedMessage.productName || selectedMessage.productTitle || selectedMessage.courseTitle ? (
                        <div>
                          <small>{selectedMessage.courseTitle && !selectedMessage.productName && !selectedMessage.productTitle ? 'THÔNG TIN LIÊN QUAN' : 'SẢN PHẨM'}</small>
                          <strong>{selectedMessage.productName || selectedMessage.productTitle || selectedMessage.courseTitle}</strong>
                        </div>
                      ) : null}
                      {selectedMessage.orderId && <div><small>MÃ ĐƠN HÀNG</small><strong>{selectedMessage.orderId}</strong></div>}
                    </div>
                  )}

                  <div className="contact-message-body">
                    <span>NỘI DUNG</span>
                    <p>{selectedMessage.message || 'Khách hàng chưa nhập nội dung tin nhắn.'}</p>
                  </div>

                  <div className="contact-message-detail-actions">
                    <div className="contact-message-primary-actions">
                      <button type="button" className="contact-message-mark-read" onClick={() => handleToggleRead(selectedMessage)}>
                        {selectedMessage.read ? '◯ Đánh dấu chưa đọc' : '✓ Đánh dấu đã đọc'}
                      </button>
                      {selectedMessage.email && (
                        <a
                          className="contact-message-reply"
                          href={`mailto:${selectedMessage.email}?subject=${encodeURIComponent('Phản hồi tin nhắn từ NP Food')}&body=${encodeURIComponent(`Xin chào ${selectedMessage.name || 'bạn'},\n\nCảm ơn bạn đã liên hệ với NP Food.`)}`}
                        >
                          Trả lời qua email
                        </a>
                      )}
                      {selectedMessage.phone && (
                        <a className="contact-message-call" href={`tel:${selectedMessage.phone}`}>Gọi khách</a>
                      )}
                    </div>
                    <button type="button" className="contact-message-delete" onClick={() => handleDeleteMessage(selectedMessage)}>Xóa tin nhắn</button>
                  </div>
                </article>
              ) : (
                <div className="contact-message-detail-placeholder">
                  <span>✉</span>
                  <strong>Chọn một tin nhắn</strong>
                  <p>Nội dung chi tiết sẽ hiển thị tại đây.</p>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default ContactMessages;
