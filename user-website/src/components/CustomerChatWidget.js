import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { sendCustomerChatMessage, subscribeToCustomerChat } from '../services/customerChatService';
import { getActiveProducts } from '../services/dataService';
import '../css/CustomerChatWidget.css';

const formatMessageTime = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('vi-VN', {
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getProductImage = (product) => (
  Array.isArray(product.imageUrls) && product.imageUrls.length > 0
    ? product.imageUrls[0]
    : product.imageUrl || ''
);

const formatPrice = (value) => `${Number(value || 0).toLocaleString('vi-VN')} ₫`;

const CustomerChatWidget = ({ user, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(Boolean(user));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [isProductPickerOpen, setIsProductPickerOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [productError, setProductError] = useState('');
  const [sendingProductId, setSendingProductId] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!isProductPickerOpen || productsLoaded) return undefined;

    let isMounted = true;
    setProductsLoading(true);
    setProductError('');
    getActiveProducts()
      .then((activeProducts) => {
        if (isMounted) {
          setProducts(activeProducts);
          setProductsLoaded(true);
        }
      })
      .catch((loadError) => {
        console.error('Không thể tải sản phẩm để gửi trong chat:', loadError);
        if (isMounted) setProductError(loadError.message || 'Không thể tải danh sách sản phẩm.');
      })
      .finally(() => {
        if (isMounted) {
          setProductsLoading(false);
          setProductsLoaded(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isProductPickerOpen, productsLoaded]);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    setError('');
    return subscribeToCustomerChat(
      user.uid,
      (nextMessages) => {
        setMessages(nextMessages);
        setLoading(false);
      },
      (subscriptionError) => {
        console.error('Không thể tải cuộc trò chuyện:', subscriptionError);
        const details = `${subscriptionError?.code || ''} ${subscriptionError?.message || ''}`;
        setError(/permission.?denied/i.test(details)
          ? 'Firebase đang từ chối quyền đọc chat. Hãy kiểm tra và Publish Database Rules.'
          : 'Không thể tải tin nhắn. Vui lòng thử lại sau.');
        setLoading(false);
      }
    );
  }, [user?.uid]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!draft.trim() || sending || !user?.uid) return;

    setSending(true);
    setError('');
    const text = draft.trim();
    const senderName = user.displayName || user.email?.split('@')[0] || 'Khách hàng';
    const createdAt = new Date().toISOString();
    try {
      const messageId = await sendCustomerChatMessage(user.uid, {
        text,
        senderName,
        email: user.email || ''
      });
      setMessages((currentMessages) => currentMessages.some((message) => message.id === messageId)
        ? currentMessages
        : [...currentMessages, {
          id: messageId,
          text,
          sender: 'customer',
          senderName,
          createdAt
        }]);
      setDraft('');
    } catch (sendError) {
      console.error('Không thể gửi tin nhắn cho cửa hàng:', sendError);
      const details = `${sendError?.code || ''} ${sendError?.message || ''}`;
      setError(/permission.?denied/i.test(details)
        ? 'Firebase đang từ chối gửi chat. Hãy kiểm tra và Publish Database Rules.'
        : sendError.message || 'Gửi tin nhắn thất bại. Vui lòng thử lại.');
    } finally {
      setSending(false);
    }
  };

  const handleComposerKeyDown = (event) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  };

  const handleSendProduct = async (product) => {
    if (!user?.uid || sendingProductId) return;

    const productData = {
      id: product.id,
      name: product.name || 'Sản phẩm',
      imageUrl: getProductImage(product),
      price: Number(product.price) || 0,
      originalPrice: Number(product.originalPrice ?? product.price) || 0
    };
    const senderName = user.displayName || user.email?.split('@')[0] || 'Khách hàng';
    const createdAt = new Date().toISOString();
    setSendingProductId(product.id);
    setProductError('');

    try {
      const messageId = await sendCustomerChatMessage(user.uid, {
        senderName,
        email: user.email || '',
        product: productData
      });
      setMessages((currentMessages) => currentMessages.some((message) => message.id === messageId)
        ? currentMessages
        : [...currentMessages, {
          id: messageId,
          text: 'Mình muốn hỏi thêm về sản phẩm này.',
          sender: 'customer',
          senderName,
          createdAt,
          product: productData
        }]);
      setIsProductPickerOpen(false);
      setProductSearchTerm('');
    } catch (sendError) {
      console.error('Không thể gửi sản phẩm trong cuộc trò chuyện:', sendError);
      setProductError(sendError.message || 'Không thể gửi sản phẩm. Vui lòng thử lại.');
    } finally {
      setSendingProductId('');
    }
  };

  const filteredProducts = products.filter((product) => {
    const query = productSearchTerm.trim().toLocaleLowerCase();
    return !query || [product.name, product.sku]
      .some((value) => String(value || '').toLocaleLowerCase().includes(query));
  });

  return (
    <section className="customer-chat-panel" role="dialog" aria-label="Nhắn tin với NP Food">
      <header className="customer-chat-header">
        <img src="/logo.png" alt="" />
        <div>
          <strong>Cửa Hàng NP FOOD</strong>
          <span><i aria-hidden="true" /> Thường trả lời trong 1 giờ</span>
        </div>
        <button type="button" onClick={onClose} aria-label="Đóng cửa sổ chat">×</button>
      </header>

      {!user ? (
        <div className="customer-chat-login">
          <span aria-hidden="true">💬</span>
          <strong>Đăng nhập để nhắn tin với shop</strong>
          <p>Đăng nhập để lưu cuộc trò chuyện và nhận phản hồi từ NP Food.</p>
          <Link to="/login" onClick={onClose}>Đăng nhập</Link>
        </div>
      ) : (
        <>
          <div className="customer-chat-messages" aria-live="polite">
            {loading ? (
              <p className="customer-chat-state">Đang tải cuộc trò chuyện...</p>
            ) : messages.length === 0 ? (
              <div className="customer-chat-welcome">
                <span aria-hidden="true">👋</span>
                <strong>Xin chào {user.displayName || 'bạn'}!</strong>
                <p>Bạn cần NP Food tư vấn gì? Hãy gửi tin nhắn bên dưới nhé.</p>
              </div>
            ) : messages.map((message) => (
              <div
                className={`customer-chat-message ${message.sender === 'customer' ? 'customer' : 'shop'}`}
                key={message.id}
              >
                {message.product && (
                  <div className="customer-chat-product-card">
                    {message.product.imageUrl ? (
                      <img src={message.product.imageUrl} alt={message.product.name} />
                    ) : (
                      <span className="customer-chat-product-placeholder" aria-hidden="true">🥬</span>
                    )}
                    <div>
                      <strong>{message.product.name}</strong>
                      <span>{formatPrice(message.product.price)}</span>
                    </div>
                  </div>
                )}
                <p>{message.text}</p>
                <time>{formatMessageTime(message.createdAt)}</time>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          {error && <p className="customer-chat-error" role="alert">{error}</p>}
          <div className="customer-chat-compose">
            <button
              type="button"
              className="customer-chat-product-trigger"
              onClick={() => {
                setProductSearchTerm('');
                setProductError('');
                setIsProductPickerOpen(true);
              }}
            >
              <span aria-hidden="true">▣</span>
              Gửi sản phẩm
            </button>
          <form className="customer-chat-form" onSubmit={handleSubmit}>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Nhập tin nhắn..."
              aria-label="Nội dung tin nhắn"
              maxLength={2000}
              rows={1}
              onKeyDown={handleComposerKeyDown}
            />
            <button type="submit" disabled={!draft.trim() || sending} aria-label="Gửi tin nhắn">
              {sending ? '...' : '➤'}
            </button>
          </form>
          </div>
          {isProductPickerOpen && (
            <div className="customer-chat-picker-backdrop">
              <section
                className="customer-chat-picker"
                role="dialog"
                aria-modal="true"
                aria-labelledby="customer-chat-picker-title"
              >
                <header className="customer-chat-picker-header">
                  <h2 id="customer-chat-picker-title">Chọn sản phẩm</h2>
                  <button
                    type="button"
                    onClick={() => setIsProductPickerOpen(false)}
                    aria-label="Đóng danh sách sản phẩm"
                  >
                    ×
                  </button>
                </header>
                <label className="customer-chat-product-search">
                  <span aria-hidden="true">⌕</span>
                  <input
                    type="search"
                    value={productSearchTerm}
                    onChange={(event) => setProductSearchTerm(event.target.value)}
                    placeholder="Tìm kiếm sản phẩm..."
                    aria-label="Tìm kiếm sản phẩm"
                  />
                </label>
                {productsLoading ? (
                  <p className="customer-chat-picker-state">Đang tải sản phẩm...</p>
                ) : productError ? (
                  <div className="customer-chat-picker-state customer-chat-picker-error" role="alert">
                    <p>{productError}</p>
                    <button type="button" onClick={() => setProductsLoaded(false)}>Thử lại</button>
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <p className="customer-chat-picker-state">
                    {products.length ? 'Không tìm thấy sản phẩm phù hợp.' : 'Hiện chưa có sản phẩm.'}
                  </p>
                ) : (
                  <div className="customer-chat-product-list">
                    {filteredProducts.map((product) => {
                      const imageUrl = getProductImage(product);
                      const productPrice = Number(product.price) || 0;
                      const originalPrice = Number(product.originalPrice ?? product.price) || 0;
                      return (
                        <article className="customer-chat-product-option" key={product.id}>
                          {imageUrl ? (
                            <img src={imageUrl} alt="" />
                          ) : (
                            <span className="customer-chat-product-placeholder" aria-hidden="true">🥬</span>
                          )}
                          <div className="customer-chat-product-option-info">
                            <strong>{product.name || 'Sản phẩm'}</strong>
                            <span className="customer-chat-product-option-price">
                              {formatPrice(productPrice)}
                              {originalPrice > productPrice && <del>{formatPrice(originalPrice)}</del>}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSendProduct(product)}
                            disabled={Boolean(sendingProductId)}
                          >
                            {sendingProductId === product.id ? 'Đang gửi...' : 'Gửi'}
                          </button>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default CustomerChatWidget;
