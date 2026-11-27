import { useState, useEffect, useMemo, useRef } from 'react';
import {
  getAllContactMessages,
  markMessageAsRead,
  markMessageAsUnread,
  deleteContactMessage,
  sendShopChatMessage,
  subscribeToCustomerChats,
  getCustomerChatVouchers
} from '../services/pageService.js';
import { getAllCustomers } from '../services/customerService.js';
import { getAllOrders } from '../services/orderService.js';
import { getAllProducts } from '../services/productService.js';
import LoadingSpinner from '../components/LoadingSpinner.js';
import '../css/ContactMessages.css';

const formatDateTime = (value) => {
  if (!value) return 'Chưa rõ thời gian';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Chưa rõ thời gian' : date.toLocaleString('vi-VN');
};

const formatPrice = (value) => `${Number(value || 0).toLocaleString('vi-VN')} ₫`;
const formatOrderDate = (value) => {
  const date = new Date(value || '');
  return Number.isNaN(date.getTime()) ? 'Chưa rõ ngày' : date.toLocaleString('vi-VN');
};
const orderStatusLabels = {
  pending: 'Chờ xác nhận',
  processing: 'Đang xử lý',
  shipped: 'Đang giao',
  delivered: 'Đã giao',
  cancelled: 'Đã hủy'
};
const getOrderItems = (order) => (
  Array.isArray(order.items)
    ? order.items
    : order.items && typeof order.items === 'object'
      ? Object.values(order.items)
      : []
);

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
  const [activeInboxTab, setActiveInboxTab] = useState('chats');
  const [chats, setChats] = useState([]);
  const [chatsLoading, setChatsLoading] = useState(true);
  const [chatsError, setChatsError] = useState('');
  const [selectedChatUid, setSelectedChatUid] = useState(null);
  const [chatDraft, setChatDraft] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [chatSendError, setChatSendError] = useState('');
  const [chatFilter, setChatFilter] = useState('all');
  const [chatSearchTerm, setChatSearchTerm] = useState('');
  const [customerDetailTab, setCustomerDetailTab] = useState('orders');
  const [customerProfiles, setCustomerProfiles] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [customerVouchers, setCustomerVouchers] = useState([]);
  const [customerDetailsLoading, setCustomerDetailsLoading] = useState(false);
  const [customerDetailsError, setCustomerDetailsError] = useState('');
  const [customerDataLoading, setCustomerDataLoading] = useState(true);
  const [customerDataError, setCustomerDataError] = useState('');
  const [shopProducts, setShopProducts] = useState([]);
  const [shopProductsLoaded, setShopProductsLoaded] = useState(false);
  const [shopProductsLoading, setShopProductsLoading] = useState(false);
  const [shopProductsError, setShopProductsError] = useState('');
  const [shopProductSearch, setShopProductSearch] = useState('');
  const [sendingProductId, setSendingProductId] = useState('');
  const [productSendError, setProductSendError] = useState('');
  const chatMessagesEndRef = useRef(null);

  useEffect(() => {
    fetchMessages();
  }, []);

  useEffect(() => subscribeToCustomerChats(
    (nextChats) => {
      setChats(nextChats);
      setChatsLoading(false);
      setChatsError('');
    },
    (error) => {
      console.error('Lỗi khi tải tin nhắn chat:', error);
      setChatsError(error.message || 'Không thể tải cuộc trò chuyện.');
      setChatsLoading(false);
    }
  ), []);

  useEffect(() => {
    let isMounted = true;
    Promise.all([getAllCustomers(), getAllOrders()])
      .then(([profiles, orders]) => {
        if (isMounted) {
          setCustomerProfiles(profiles);
          setAllOrders(orders);
        }
      })
      .catch((error) => {
        console.error('Lỗi khi tải thông tin khách hàng cho hộp thư chat:', error);
        if (isMounted) setCustomerDataError(error.message || 'Không thể tải thông tin khách hàng.');
      })
      .finally(() => {
        if (isMounted) setCustomerDataLoading(false);
      });

    return () => {
      isMounted = false;
    };
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
  const needsReplyCount = chats.filter((chat) => chat.messages[chat.messages.length - 1]?.sender === 'customer').length;
  const filteredChats = chats.filter((chat) => {
    const latestMessage = chat.messages[chat.messages.length - 1];
    const matchesFilter = chatFilter === 'all' ||
      (chatFilter === 'needs-reply' && latestMessage?.sender === 'customer') ||
      (chatFilter === 'replied' && latestMessage?.sender === 'shop');
    const query = chatSearchTerm.trim().toLocaleLowerCase();
    const matchesSearch = !query ||
      [chat.name, chat.email, latestMessage?.text]
        .some((value) => String(value || '').toLocaleLowerCase().includes(query));
    return matchesFilter && matchesSearch;
  });
  const selectedChat = filteredChats.find((chat) => chat.uid === selectedChatUid) || filteredChats[0] || null;
  const activeCustomerUid = selectedChat?.uid;
  const selectedCustomer = selectedChat
    ? customerProfiles.find((profile) => profile.id === selectedChat.uid || profile.uid === selectedChat.uid) || {
      uid: selectedChat.uid,
      name: selectedChat.name,
      email: selectedChat.email
    }
    : null;
  const selectedCustomerOrders = selectedChat ? allOrders.filter((order) => {
    const orderUid = String(order.customerUid || order.customer?.uid || '').trim();
    if (orderUid) return orderUid === selectedChat.uid;
    const orderEmail = String(order.customer?.email || order.email || '').trim().toLocaleLowerCase();
    return Boolean(selectedChat.email) && orderEmail === selectedChat.email.toLocaleLowerCase();
  }) : [];
  const selectedCustomerVouchers = customerVouchers;
  const filteredShopProducts = shopProducts.filter((product) => {
    const query = shopProductSearch.trim().toLocaleLowerCase();
    return !query || [product.name, product.sku]
      .some((value) => String(value || '').toLocaleLowerCase().includes(query));
  });
  const unreadCount = messages.filter((message) => !message.read).length;

  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [selectedChat?.uid, selectedChat?.messages.length]);

  useEffect(() => {
    if (!activeCustomerUid) {
      setCustomerVouchers([]);
      return undefined;
    }

    let isMounted = true;
    setCustomerDetailsLoading(true);
    setCustomerDetailsError('');
    setCustomerVouchers([]);
    getCustomerChatVouchers(activeCustomerUid)
      .then((vouchers) => {
        if (isMounted) setCustomerVouchers(vouchers);
      })
      .catch((error) => {
        console.error('Lỗi khi tải voucher khách hàng:', error);
        if (isMounted) setCustomerDetailsError(error.message || 'Không thể tải voucher khách hàng.');
      })
      .finally(() => {
        if (isMounted) setCustomerDetailsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeCustomerUid]);

  useEffect(() => {
    if (customerDetailTab !== 'products' || shopProductsLoaded) return undefined;

    let isMounted = true;
    setShopProductsLoading(true);
    setShopProductsError('');
    getAllProducts()
      .then((products) => {
        if (isMounted) setShopProducts(products.filter((product) => product.isActive !== false));
      })
      .catch((error) => {
        console.error('Lỗi khi tải sản phẩm để gửi cho khách:', error);
        if (isMounted) setShopProductsError(error.message || 'Không thể tải sản phẩm.');
      })
      .finally(() => {
        if (isMounted) {
          setShopProductsLoading(false);
          setShopProductsLoaded(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [customerDetailTab, shopProductsLoaded]);

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

  const handleSendChatReply = async (event) => {
    event.preventDefault();
    if (!selectedChat || !chatDraft.trim() || chatSending) return;

    setChatSending(true);
    setChatSendError('');
    try {
      await sendShopChatMessage(selectedChat.uid, chatDraft);
      setChatDraft('');
    } catch (error) {
      console.error('Lỗi khi trả lời tin nhắn chat:', error);
      setChatSendError(error.message || 'Không thể gửi tin nhắn. Vui lòng thử lại.');
    } finally {
      setChatSending(false);
    }
  };

  const handleSendShopProduct = async (product) => {
    if (!selectedChat || sendingProductId) return;

    setSendingProductId(product.id);
    setProductSendError('');
    try {
      await sendShopChatMessage(selectedChat.uid, '', {
        id: product.id,
        name: product.name || 'Sản phẩm',
        imageUrl: Array.isArray(product.imageUrls) && product.imageUrls.length > 0
          ? product.imageUrls[0]
          : product.imageUrl || '',
        price: Number(product.price) || 0,
        originalPrice: Number(product.originalPrice ?? product.price) || 0
      });
    } catch (error) {
      console.error('Lỗi khi gửi sản phẩm cho khách:', error);
      setProductSendError(error.message || 'Không thể gửi sản phẩm. Vui lòng thử lại.');
    } finally {
      setSendingProductId('');
    }
  };

  const handleChatComposerKeyDown = (event) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  };

  return (
    <div className="contact-messages-container">
      <div className="contact-messages-page">
        <div className="contact-messages-heading">
          <div>
            <span className="contact-messages-eyebrow">CHĂM SÓC KHÁCH HÀNG</span>
            <h2>Tin nhắn khách hàng</h2>
            
          </div>
          <div className="contact-messages-count">
            <span className="contact-messages-count-icon">✉</span>
            <div><small>Tin chưa đọc</small><strong>{unreadCount}</strong></div>
          </div>
        </div>

        <div className="contact-inbox-tabs" role="tablist" aria-label="Loại hộp thư">
          <button
            type="button"
            role="tab"
            aria-selected={activeInboxTab === 'chats'}
            className={activeInboxTab === 'chats' ? 'active' : ''}
            onClick={() => setActiveInboxTab('chats')}
          >
            Chat với khách <span>{chats.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeInboxTab === 'contacts'}
            className={activeInboxTab === 'contacts' ? 'active' : ''}
            onClick={() => setActiveInboxTab('contacts')}
          >
            Tin nhắn liên hệ <span>{messages.length}</span>
          </button>
        </div>

        {activeInboxTab === 'contacts' && (loading ? (
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
        ))}

        {activeInboxTab === 'chats' && (chatsLoading ? (
          <div className="contact-messages-state">
            <LoadingSpinner message="Đang tải cuộc trò chuyện..." inline />
          </div>
        ) : chatsError ? (
          <div className="contact-messages-error" role="alert">
            <strong>Không tải được cuộc trò chuyện</strong>
            <p>{chatsError}</p>
          </div>
        ) : (
          <section className="customer-chat-inbox">
          <aside className="customer-chat-filter-sidebar" aria-label="Bộ lọc cuộc trò chuyện">
            <h3>Hộp thư</h3>
            <button
              type="button"
              className={chatFilter === 'needs-reply' ? 'active' : ''}
              onClick={() => setChatFilter('needs-reply')}
            >
              <span>Chưa trả lời</span><strong>{needsReplyCount}</strong>
            </button>
            <button
              type="button"
              className={chatFilter === 'all' ? 'active' : ''}
              onClick={() => setChatFilter('all')}
            >
              <span>Tất cả</span><strong>{chats.length}</strong>
            </button>
            <button
              type="button"
              className={chatFilter === 'replied' ? 'active' : ''}
              onClick={() => setChatFilter('replied')}
            >
              <span>Đã trả lời</span><strong>{chats.length - needsReplyCount}</strong>
            </button>
          </aside>

          <aside className="customer-chat-inbox-list" aria-label="Danh sách cuộc trò chuyện">
            <label className="customer-chat-list-search">
              <span aria-hidden="true">⌕</span>
              <input
                type="search"
                value={chatSearchTerm}
                onChange={(event) => setChatSearchTerm(event.target.value)}
                placeholder="Tìm khách, tin nhắn..."
                aria-label="Tìm cuộc trò chuyện"
              />
            </label>
            {filteredChats.length === 0 ? (
                <div className="contact-inbox-empty">
                  <span>💬</span>
                <strong>{chats.length ? 'Không tìm thấy hội thoại' : 'Chưa có cuộc trò chuyện'}</strong>
                <p>{chats.length ? 'Thử từ khóa hoặc bộ lọc khác.' : 'Tin nhắn khách gửi từ website sẽ xuất hiện tại đây.'}</p>
                </div>
            ) : filteredChats.map((chat) => {
                const latestMessage = chat.messages[chat.messages.length - 1];
                const isSelected = selectedChat?.uid === chat.uid;
                return (
                  <button
                    type="button"
                    key={chat.uid}
                    className={`contact-message-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedChatUid(chat.uid);
                      setChatSendError('');
                    }}
                    aria-current={isSelected ? 'true' : undefined}
                  >
                    <span className="contact-message-avatar">{chat.name.trim().charAt(0).toLocaleUpperCase()}</span>
                    <span className="contact-message-list-content">
                      <span className="contact-message-list-top">
                        <strong>{chat.name}</strong>
                        <time>{formatDateTime(latestMessage?.createdAt)}</time>
                      </span>
                      <span className="contact-message-list-preview">
                        {latestMessage?.product ? `Sản phẩm: ${latestMessage.product.name}` : latestMessage?.text || ''}
                      </span>
                    </span>
                    {latestMessage?.sender === 'customer' && <span className="contact-message-unread-dot" aria-label="Chưa trả lời" />}
                  </button>
                );
              })}
            </aside>

            {selectedChat ? (
              <div className="customer-chat-conversation">
                <header className="customer-chat-conversation-header">
                  <span className="contact-message-avatar">{selectedChat.name.trim().charAt(0).toLocaleUpperCase()}</span>
                  <div>
                    <strong>{selectedChat.name}</strong>
                    {selectedChat.email && <a href={`mailto:${selectedChat.email}`}>{selectedChat.email}</a>}
                  </div>
                </header>
                <div className="customer-chat-conversation-messages" aria-live="polite">
                  {selectedChat.messages.map((message) => (
                    <div className={`customer-chat-admin-message ${message.sender === 'shop' ? 'shop' : 'customer'}`} key={message.id}>
                      <span>{message.sender === 'shop' ? 'NP Food' : selectedChat.name}</span>
                      {message.product && (
                        <div className="customer-chat-admin-product">
                          {message.product.imageUrl ? (
                            <img src={message.product.imageUrl} alt={message.product.name || 'Sản phẩm'} />
                          ) : (
                            <span aria-hidden="true">🥬</span>
                          )}
                          <div>
                            <strong>{message.product.name || 'Sản phẩm'}</strong>
                            <small>{formatPrice(message.product.price)}</small>
                          </div>
                        </div>
                      )}
                      <p>{message.text}</p>
                      <time>{formatDateTime(message.createdAt)}</time>
                    </div>
                  ))}
                  <div ref={chatMessagesEndRef} />
                </div>
                {chatSendError && <p className="customer-chat-admin-error" role="alert">{chatSendError}</p>}
                <form className="customer-chat-admin-form" onSubmit={handleSendChatReply}>
                  <textarea
                    value={chatDraft}
                    onChange={(event) => setChatDraft(event.target.value)}
                    placeholder="Nhập nội dung phản hồi..."
                    aria-label="Nội dung phản hồi"
                    maxLength={2000}
                    rows={2}
                    onKeyDown={handleChatComposerKeyDown}
                  />
                  <button type="submit" disabled={!chatDraft.trim() || chatSending}>
                    {chatSending ? 'Đang gửi...' : 'Gửi trả lời'}
                  </button>
                </form>
              </div>
            ) : (
              <div className="contact-message-detail-placeholder">
                <span>💬</span>
                <strong>Chọn một cuộc trò chuyện</strong>
                <p>Nội dung trao đổi với khách sẽ hiển thị tại đây.</p>
              </div>
            )}

            <aside className="customer-chat-customer-details" aria-label="Thông tin khách hàng">
              {selectedCustomer ? (
                <>
                  <header className="customer-chat-customer-profile">
                    <span className="contact-message-avatar">
                      {(selectedCustomer.name || selectedChat.name || 'K').trim().charAt(0).toLocaleUpperCase()}
                    </span>
                    <div>
                      <strong>{selectedCustomer.name || selectedChat.name || 'Khách hàng'}</strong>
                      <span>Khách hàng</span>
                    </div>
                    {selectedCustomer.phone && <a href={`tel:${selectedCustomer.phone}`}>Gọi</a>}
                  </header>
                  <div className="customer-chat-customer-contact">
                    {(selectedCustomer.email || selectedChat.email) && (
                      <a href={`mailto:${selectedCustomer.email || selectedChat.email}`}>
                        {selectedCustomer.email || selectedChat.email}
                      </a>
                    )}
                    {selectedCustomer.uid && <small>Mã khách: {selectedCustomer.uid}</small>}
                  </div>
                  <div className="customer-chat-detail-tabs" role="tablist" aria-label="Thông tin liên quan">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={customerDetailTab === 'orders'}
                      className={customerDetailTab === 'orders' ? 'active' : ''}
                      onClick={() => setCustomerDetailTab('orders')}
                    >
                      Đơn hàng <span>{selectedCustomerOrders.length}</span>
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={customerDetailTab === 'products'}
                      className={customerDetailTab === 'products' ? 'active' : ''}
                      onClick={() => setCustomerDetailTab('products')}
                    >
                      Sản phẩm
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={customerDetailTab === 'vouchers'}
                      className={customerDetailTab === 'vouchers' ? 'active' : ''}
                      onClick={() => setCustomerDetailTab('vouchers')}
                    >
                      Voucher
                    </button>
                  </div>
                  <div className="customer-chat-detail-content">
                    {customerDetailTab === 'orders' && (
                      customerDataLoading ? (
                        <LoadingSpinner message="Đang tải đơn hàng..." inline />
                      ) : customerDataError ? (
                        <p className="customer-chat-detail-state error" role="alert">{customerDataError}</p>
                      ) : selectedCustomerOrders.length === 0 ? (
                        <p className="customer-chat-detail-state">Khách hàng chưa có đơn hàng.</p>
                      ) : selectedCustomerOrders.map((order) => {
                        const status = String(order.status || 'pending').toLowerCase();
                        const items = getOrderItems(order);
                        return (
                          <article className="customer-chat-order-card" key={order.id}>
                            <header>
                              <strong>{orderStatusLabels[status] || 'Đơn hàng'}</strong>
                              <time>{formatOrderDate(order.createdAt || order.orderDate)}</time>
                            </header>
                            <small>#{order.id}</small>
                            {items.slice(0, 3).map((item, index) => (
                              <p key={`${order.id}-item-${index}`}>
                                {item.name || item.productName || 'Sản phẩm'}
                                <span>×{item.quantity || item.qty || 1}</span>
                              </p>
                            ))}
                            <footer>
                              <span>{items.length} mặt hàng</span>
                              <strong>{formatPrice(order.totalAmount ?? order.total ?? order.amount)}</strong>
                            </footer>
                          </article>
                        );
                      })
                    )}
                    {customerDetailTab === 'products' && (
                      <>
                        <label className="customer-chat-product-search">
                          <span aria-hidden="true">⌕</span>
                          <input
                            type="search"
                            value={shopProductSearch}
                            onChange={(event) => setShopProductSearch(event.target.value)}
                            placeholder="Tìm sản phẩm..."
                            aria-label="Tìm sản phẩm để gửi cho khách"
                          />
                        </label>
                        {productSendError && <p className="customer-chat-detail-state error" role="alert">{productSendError}</p>}
                        {shopProductsLoading ? (
                          <LoadingSpinner message="Đang tải sản phẩm..." inline />
                        ) : shopProductsError ? (
                          <div className="customer-chat-detail-state error" role="alert">
                            <p>{shopProductsError}</p>
                            <button type="button" onClick={() => setShopProductsLoaded(false)}>Thử lại</button>
                          </div>
                        ) : filteredShopProducts.length === 0 ? (
                          <p className="customer-chat-detail-state">
                            {shopProducts.length ? 'Không tìm thấy sản phẩm.' : 'Shop chưa có sản phẩm đang bán.'}
                          </p>
                        ) : filteredShopProducts.map((product) => {
                          const imageUrl = Array.isArray(product.imageUrls) && product.imageUrls.length > 0
                            ? product.imageUrls[0]
                            : product.imageUrl || '';
                          return (
                            <article className="customer-chat-detail-product" key={product.id}>
                              {imageUrl ? <img src={imageUrl} alt="" /> : <span aria-hidden="true">🥬</span>}
                              <div>
                                <strong>{product.name || 'Sản phẩm'}</strong>
                                <span>{formatPrice(product.price)}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleSendShopProduct(product)}
                                disabled={Boolean(sendingProductId)}
                              >
                                {sendingProductId === product.id ? '...' : 'Gửi'}
                              </button>
                            </article>
                          );
                        })}
                      </>
                    )}
                    {customerDetailTab === 'vouchers' && (
                      customerDetailsLoading ? (
                        <LoadingSpinner message="Đang tải voucher..." inline />
                      ) : customerDetailsError ? (
                        <p className="customer-chat-detail-state error" role="alert">{customerDetailsError}</p>
                      ) : selectedCustomerVouchers.length === 0 ? (
                        <p className="customer-chat-detail-state">Khách hàng chưa có voucher.</p>
                      ) : selectedCustomerVouchers.map((voucher) => (
                        <article className="customer-chat-voucher-card" key={voucher.id}>
                          <strong>{voucher.name || 'Voucher NP Food'}</strong>
                          <span>{voucher.code || voucher.id}</span>
                          <small>{voucher.status === 'redeemed' ? 'Đã sử dụng' : 'Có thể sử dụng'}</small>
                        </article>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <div className="contact-message-detail-placeholder">
                  <span>👤</span>
                  <strong>Thông tin khách hàng</strong>
                  <p>Chọn một cuộc trò chuyện để xem chi tiết.</p>
                </div>
              )}
            </aside>
          </section>
        ))}
      </div>
    </div>
  );
};

export default ContactMessages;
