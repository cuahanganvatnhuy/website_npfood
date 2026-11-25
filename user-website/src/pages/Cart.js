import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import DeliveryAddressPicker from '../components/DeliveryAddressPicker';
import {
  calculateVoucherDiscount,
  createOrder,
  getActiveProducts,
  getPaymentSettings,
  getCustomerVoucherClaims
} from '../services/dataService';
import { getCustomerProfile } from '../services/customerAuthService';
import '../css/Cart.css';

const emptyCustomer = { name: '', phone: '', email: '', address: '', note: '' };
const formatPrice = (value) => `${Number(value || 0).toLocaleString('vi-VN')} ₫`;
const initialPaymentSettings = { enabled: false, qrImageUrl: '' };

const Cart = ({ cartItems, onUpdateQuantity, onRemove, onClear, onSyncCart, user, authReady }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const requestedVoucherId = location.state?.voucherId || '';
  const [customer, setCustomer] = useState(emptyCustomer);
  const [deliveryMethod, setDeliveryMethod] = useState('delivery');
  const [paymentMethod, setPaymentMethod] = useState('cash_on_delivery');
  const [paymentSettings, setPaymentSettings] = useState(initialPaymentSettings);
  const [paymentSettingsError, setPaymentSettingsError] = useState('');
  const [momoQrUnavailable, setMomoQrUnavailable] = useState(false);
  const [momoConfirmationOpen, setMomoConfirmationOpen] = useState(false);
  const [momoSuccessOpen, setMomoSuccessOpen] = useState(false);
  const [momoCopyFeedback, setMomoCopyFeedback] = useState('');
  const [momoConfirmationError, setMomoConfirmationError] = useState('');
  const [pendingMomoOrder, setPendingMomoOrder] = useState(null);
  const [deliveryAddress, setDeliveryAddress] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [completedOrder, setCompletedOrder] = useState(null);
  const [cartHydrated, setCartHydrated] = useState(false);
  const [customerVouchers, setCustomerVouchers] = useState([]);
  const [customerProfile, setCustomerProfile] = useState(null);
  const [customerProfileLoading, setCustomerProfileLoading] = useState(false);
  const [usePoints, setUsePoints] = useState(false);
  const [voucherLoadError, setVoucherLoadError] = useState('');
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [voucherModalOpen, setVoucherModalOpen] = useState(false);
  const [selectedVoucherId, setSelectedVoucherId] = useState(requestedVoucherId);
  const [pendingVoucherId, setPendingVoucherId] = useState(requestedVoucherId);
  const subtotal = cartItems.reduce((sum, item) => sum + Number(item.price || 0) * item.quantity, 0);
  const availablePoints = Math.max(0, Math.floor(Number(customerProfile?.points) || 0));
  const availableVouchers = customerVouchers.filter((voucher) => (
    voucher.status === 'available' &&
    (!voucher.expiresAt || new Date(voucher.expiresAt).getTime() > Date.now())
  ));
  const voucherModalItems = customerVouchers.map((voucher) => {
    const voucherId = voucher.voucherId || voucher.id;
    const expiresAt = voucher.expiresAt ? new Date(voucher.expiresAt).getTime() : Infinity;
    const expired = expiresAt !== Infinity &&
      (!Number.isFinite(expiresAt) || expiresAt <= Date.now());
    const minOrder = Number(voucher.minOrder) || 0;
    let unavailableReason = '';

    if (voucher.status !== 'available') {
      unavailableReason = voucher.status === 'redeemed' ? 'Voucher đã được sử dụng.' : 'Voucher không khả dụng.';
    } else if (expired) {
      unavailableReason = 'Voucher đã hết hạn.';
    } else if (subtotal < minOrder) {
      unavailableReason = `Đơn hàng cần từ ${formatPrice(minOrder)} để sử dụng.`;
    }

    return {
      ...voucher,
      voucherId,
      unavailableReason,
      usable: !unavailableReason
    };
  });
  const selectedVoucher = availableVouchers.find(
    (voucher) => (voucher.voucherId || voucher.id) === selectedVoucherId
  );
  const pendingVoucher = voucherModalItems.find(
    (voucher) => voucher.voucherId === pendingVoucherId
  );
  const voucherDiscount = selectedVoucher
    ? calculateVoucherDiscount(selectedVoucher, subtotal)
    : 0;
  const maximumPointsDiscount = Math.min(
    availablePoints,
    Math.max(0, subtotal - voucherDiscount)
  );
  const pointsDiscount = usePoints ? maximumPointsDiscount : 0;
  const totalDiscount = voucherDiscount + pointsDiscount;
  const totalAfterDiscount = subtotal - totalDiscount;

  useEffect(() => {
    let active = true;
    getPaymentSettings()
      .then((settings) => {
        if (active) setPaymentSettings(settings);
      })
      .catch((error) => {
        console.error('Không thể tải cài đặt thanh toán:', error);
        if (active) setPaymentSettingsError('Không tải được cài đặt MoMo. Vui lòng chọn thanh toán khi nhận hàng.');
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!momoConfirmationOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !submitting) setMomoConfirmationOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [momoConfirmationOpen, submitting]);

  useEffect(() => {
    if (!momoSuccessOpen) return undefined;
    const redirectTimer = window.setTimeout(() => navigate('/products', { replace: true }), 2000);
    return () => window.clearTimeout(redirectTimer);
  }, [momoSuccessOpen, navigate]);

  const handleAddressChange = useCallback((address) => {
    setDeliveryAddress(address);
    if (!address) return;
    setCustomer((current) => ({
      ...current,
      name: address.name || current.name,
      phone: address.phone || current.phone,
      address: address.address || current.address
    }));
  }, []);

  const handleCopyPaymentReference = async () => {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Trình duyệt không hỗ trợ sao chép.');
      }
      await navigator.clipboard.writeText(
        pendingMomoOrder?.paymentReference || completedOrder?.paymentReference || ''
      );
      setMomoCopyFeedback('Đã sao chép nội dung chuyển khoản.');
    } catch (copyError) {
      console.error('Không thể sao chép nội dung chuyển khoản:', copyError);
      setMomoCopyFeedback('Không sao chép được. Vui lòng nhập thủ công.');
    }
  };

  useEffect(() => {
    if (!user) {
      setCustomer(emptyCustomer);
      setCustomerProfile(null);
      setCustomerProfileLoading(false);
      setUsePoints(false);
      return undefined;
    }

    let isMounted = true;
    setCustomerProfileLoading(true);
    setCustomerProfile(null);
    setCustomer(emptyCustomer);
    setUsePoints(false);
    getCustomerProfile(user.uid)
      .then((profile) => {
        if (!isMounted) return;
        setCustomerProfile(profile);
        setCustomer((current) => ({
          ...current,
          name: profile?.name || user.displayName || current.name,
          phone: profile?.phone || current.phone,
          email: user.email || '',
          address: profile?.address || current.address
        }));
      })
      .catch((error) => {
        if (!isMounted) return;
        console.error('Không thể tải hồ sơ khách hàng:', error);
        setCheckoutError('Không thể tải hồ sơ khách hàng. Vui lòng nhập lại thông tin nhận hàng.');
      })
      .finally(() => {
        if (isMounted) setCustomerProfileLoading(false);
      });

    return () => { isMounted = false; };
  }, [user]);

  useEffect(() => {
    if (!user?.uid) {
      setCustomerVouchers([]);
      setSelectedVoucherId('');
      setVoucherLoadError('');
      setVoucherLoading(false);
      return undefined;
    }

    let isMounted = true;
    setVoucherLoadError('');
    setVoucherLoading(true);
    getCustomerVoucherClaims(user.uid)
      .then((claims) => {
        if (!isMounted) return;
        setCustomerVouchers(claims);
        setSelectedVoucherId(requestedVoucherId);
      })
      .catch((error) => {
        if (!isMounted) return;
        console.error('Không thể tải Kho voucher khi thanh toán:', error);
        setVoucherLoadError('Không thể tải voucher đã lưu. Bạn vẫn có thể đặt hàng không dùng voucher.');
      })
      .finally(() => {
        if (isMounted) setVoucherLoading(false);
      });

    return () => { isMounted = false; };
  }, [user?.uid, requestedVoucherId]);

  useEffect(() => {
    if (!voucherModalOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setVoucherModalOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [voucherModalOpen]);

  useEffect(() => {
    if (cartHydrated) return undefined;
    if (cartItems.length === 0) {
      setCartHydrated(true);
      return undefined;
    }

    let isMounted = true;
    getActiveProducts()
      .then((products) => {
        if (!isMounted) return;
        const hydratedItems = cartItems.map((item) => {
          const product = products.find((candidate) => candidate.id === item.id);
          if (!product) return item;
          return {
            ...item,
            name: product.name || item.name,
            price: Number(product.price) || 0,
            originalPrice: Number(product.originalPrice ?? product.price) || 0,
            flashSale: product.flashSale || null,
            stock: Number(product.stock) || 0,
            imageUrl: Array.isArray(product.imageUrls) && product.imageUrls.length > 0
              ? product.imageUrls[0]
              : product.imageUrl || ''
          };
        });
        setCartHydrated(true);
        onSyncCart(hydratedItems);
      })
      .catch((error) => {
        if (!isMounted) return;
        setCartHydrated(true);
        console.error('Lỗi khi tải thông tin giỏ hàng:', error);
        setCheckoutError('Không thể tải thông tin sản phẩm mới nhất. Vui lòng kiểm tra kết nối trước khi đặt hàng.');
      });

    return () => { isMounted = false; };
  }, [cartItems, cartHydrated, onSyncCart]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (cartItems.length === 0) return;
    if (!user) {
      setCheckoutError('Vui lòng đăng ký hoặc đăng nhập để đặt hàng.');
      return;
    }
    if (deliveryMethod === 'delivery' && !deliveryAddress?.address) {
      setCheckoutError('Vui lòng chọn hoặc thêm địa chỉ giao hàng.');
      return;
    }
    setSubmitting(true);
    setCheckoutError('');

    try {
      const currentProducts = await getActiveProducts();
      const refreshedItems = cartItems.map((item) => {
        const latestProduct = currentProducts.find((product) => product.id === item.id);
        if (!latestProduct) {
          throw new Error(`"${item.name}" hiện không còn được bán. Vui lòng xóa sản phẩm này khỏi giỏ hàng.`);
        }
        const stock = Number(latestProduct.stock) || 0;
        if (stock < item.quantity) {
          throw new Error(`"${item.name}" chỉ còn ${stock} sản phẩm. Vui lòng điều chỉnh số lượng.`);
        }
        return {
          ...item,
          name: latestProduct.name || item.name,
          price: Number(latestProduct.price) || 0,
          originalPrice: Number(latestProduct.originalPrice ?? latestProduct.price) || 0,
          flashSale: latestProduct.flashSale || null,
          stock,
          imageUrl: Array.isArray(latestProduct.imageUrls) && latestProduct.imageUrls.length > 0
            ? latestProduct.imageUrls[0]
            : latestProduct.imageUrl || ''
        };
      });

      const priceChanged = refreshedItems.some((item, index) => Number(item.price) !== Number(cartItems[index].price));
      if (priceChanged) {
        onSyncCart(refreshedItems);
        setCheckoutError('Giá sản phẩm vừa được cập nhật. Giỏ hàng đã đồng bộ giá mới, vui lòng kiểm tra lại đơn hàng.');
        return;
      }

      const currentSubtotal = refreshedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const selectedClaim = availableVouchers.find(
        (voucher) => (voucher.voucherId || voucher.id) === selectedVoucherId
      );
      const currentDiscount = selectedClaim
        ? calculateVoucherDiscount(selectedClaim, currentSubtotal)
        : 0;
      if (selectedVoucherId && !selectedClaim) {
        throw new Error('Voucher đã hết hạn hoặc không còn khả dụng. Vui lòng chọn mã khác.');
      }
      if (selectedClaim && currentDiscount <= 0) {
        throw new Error(`Đơn hàng chưa đạt mức tối thiểu ${formatPrice(selectedClaim.minOrder)} của voucher.`);
      }
      const currentPointsToRedeem = usePoints
        ? Math.min(
          availablePoints,
          Math.max(0, currentSubtotal - currentDiscount)
        )
        : 0;
      const currentTotal = currentSubtotal - currentDiscount - currentPointsToRedeem;
      const orderPayload = {
        customerUid: user.uid,
        customer: {
          name: customer.name.trim(),
          phone: customer.phone.trim(),
          email: user.email || '',
          address: deliveryMethod === 'pickup'
            ? 'Nhận tại cửa hàng'
            : deliveryAddress.address.trim()
        },
        deliveryMethod,
        paymentMethod,
        deliveryLocation: deliveryMethod === 'delivery' &&
          typeof deliveryAddress.latitude === 'number' &&
          Number.isFinite(deliveryAddress.latitude) &&
          typeof deliveryAddress.longitude === 'number' &&
          Number.isFinite(deliveryAddress.longitude)
          ? {
            latitude: deliveryAddress.latitude,
            longitude: deliveryAddress.longitude
          }
          : null,
        items: refreshedItems.map((item) => ({
          productId: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          imageUrl: item.imageUrl
        })),
        totalAmount: currentTotal,
        subtotalAmount: currentSubtotal,
        discountAmount: currentDiscount + currentPointsToRedeem,
        voucherDiscountAmount: currentDiscount,
        pointsToRedeem: currentPointsToRedeem,
        voucherId: selectedClaim?.voucherId || '',
        note: customer.note.trim()
      };

      if (paymentMethod === 'momo') {
        if (!customer.phone.trim()) {
          throw new Error('Vui lòng nhập số điện thoại để tạo nội dung chuyển khoản MoMo.');
        }
        if (!paymentSettings.enabled || !paymentSettings.qrImageUrl) {
          throw new Error('Thanh toán MoMo hiện không khả dụng. Vui lòng chọn thanh toán khi nhận hàng.');
        }
        const orderNumber = `NP-${Date.now().toString().slice(-8)}`;
        setPendingMomoOrder({
          ...orderPayload,
          orderNumber,
          paymentMethod: 'momo',
          paymentReference: `${orderNumber} ${customer.phone.trim()}`,
          totalAmount: currentTotal,
          qrImageUrl: paymentSettings.qrImageUrl
        });
        setMomoCopyFeedback('');
        return;
      }

      const order = await createOrder(orderPayload);
      setCompletedOrder(order);
      setCustomer(emptyCustomer);
      onClear();
    } catch (error) {
      console.error('Lỗi khi đặt hàng:', error);
      setCheckoutError(error.message || 'Đặt hàng chưa thành công. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMomoPaymentConfirmation = async () => {
    if (!pendingMomoOrder || submitting) return;
    setSubmitting(true);
    setMomoConfirmationError('');
    try {
      const order = await createOrder({
        ...pendingMomoOrder,
        orderNumber: pendingMomoOrder.orderNumber,
        expectedMomoQrImageUrl: pendingMomoOrder.qrImageUrl
      });
      setCompletedOrder(order);
      setPendingMomoOrder(null);
      setCustomer(emptyCustomer);
      onClear();
      setMomoConfirmationOpen(false);
      setMomoSuccessOpen(true);
    } catch (error) {
      console.error('Lỗi khi xác nhận thanh toán MoMo:', error);
      setMomoConfirmationError(
        error.message || 'Không thể gửi đơn hàng. Vui lòng thử lại.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (completedOrder || pendingMomoOrder) {
    const displayOrder = completedOrder || pendingMomoOrder;
    const momoOrder = displayOrder.paymentMethod === 'momo';
    const awaitingMomoConfirmation = momoOrder && !completedOrder;
    return (
      <div className="store-cart-page">
        <div className="store-order-success">
          <span className="store-order-success-icon">{momoOrder ? '◷' : '✓'}</span>
          <span className="store-cart-eyebrow">
            {momoOrder
              ? awaitingMomoConfirmation ? 'THANH TOÁN MOMO' : 'ĐƠN HÀNG ĐÃ ĐƯỢC GỬI'
              : 'ĐẶT HÀNG THÀNH CÔNG'}
          </span>
          <h1>
            {momoOrder
              ? awaitingMomoConfirmation ? 'Thanh toán bằng MoMo' : 'Hoàn tất thanh toán MoMo'
              : 'Cảm ơn bạn đã mua hàng!'}
          </h1>
          <p>
            {awaitingMomoConfirmation
              ? <>Mã chuyển khoản <strong>{displayOrder.orderNumber}</strong>. Đơn hàng chỉ được gửi đến cửa hàng sau khi bạn xác nhận đã chuyển khoản.</>
              : <>
                  Đơn hàng <strong>{displayOrder.orderNumber}</strong>
                  {momoOrder
                    ? ' đã được gửi đến cửa hàng để kiểm tra thanh toán.'
                    : ' đã được gửi đến cửa hàng. Nhân viên sẽ liên hệ để xác nhận.'}
                </>}
          </p>
          {momoOrder && (
            <section className="store-momo-payment" aria-label="Thông tin thanh toán MoMo">
              <h2>Thanh toán bằng MoMo</h2>
              <p className="store-momo-payment-amount">
                Số tiền cần chuyển: <strong>{formatPrice(displayOrder.totalAmount)}</strong>
              </p>
              <div className="store-momo-qr">
                {!momoQrUnavailable ? (
                  <img
                    src={displayOrder.qrImageUrl}
                    alt={`Mã QR MoMo của cửa hàng cho đơn ${displayOrder.orderNumber}`}
                    onError={() => setMomoQrUnavailable(true)}
                  />
                ) : (
                  <p>Không tải được ảnh QR. Vui lòng liên hệ cửa hàng và cung cấp mã đơn hàng.</p>
                )}
              </div>
              <div className="store-momo-transfer-reference">
                <div className="store-momo-transfer-reference-heading">
                  <span>Nội dung chuyển khoản</span>
                  <button
                    type="button"
                    className="store-momo-copy-button"
                    aria-label="Sao chép nội dung chuyển khoản"
                    title="Sao chép nội dung chuyển khoản"
                    onClick={handleCopyPaymentReference}
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      width="17"
                      height="17"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="8" y="8" width="12" height="12" rx="2" />
                      <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
                    </svg>
                  </button>
                </div>
                <strong>{displayOrder.paymentReference}</strong>
                <small>Gồm mã đơn hàng và số điện thoại bạn đã đăng ký.</small>
                {momoCopyFeedback && (
                  <small className="store-momo-copy-feedback" role="status">
                    {momoCopyFeedback}
                  </small>
                )}
              </div>
              {awaitingMomoConfirmation && (
                <button
                  type="button"
                  className="store-momo-confirm-button"
                  onClick={() => {
                    setMomoConfirmationError('');
                    setMomoConfirmationOpen(true);
                  }}
                >
                  Xác nhận đã chuyển khoản
                </button>
              )}
            </section>
          )}
          <div className="store-order-success-actions">
            <Link to="/products" className="store-cart-primary">Tiếp tục mua sắm</Link>
            <Link to="/contact" className="store-cart-secondary">Liên hệ cửa hàng</Link>
          </div>
        </div>
        {awaitingMomoConfirmation && momoConfirmationOpen && (
          <div
            className="store-momo-confirm-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !submitting) {
                setMomoConfirmationOpen(false);
              }
            }}
          >
            <section
              className="store-momo-confirm-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="store-momo-confirm-title"
              aria-describedby="store-momo-confirm-description"
            >
              <span className="store-momo-confirm-icon" aria-hidden="true">₫</span>
              <h2 id="store-momo-confirm-title">Xác nhận thanh toán MoMo</h2>
              <p id="store-momo-confirm-description">
                Bạn đã chuyển {formatPrice(displayOrder.totalAmount)} với nội dung {displayOrder.paymentReference}?
                Xác nhận sẽ gửi đơn hàng đến cửa hàng để kiểm tra thanh toán. Nếu chưa chuyển, chọn Hủy; đơn hàng sẽ chưa được gửi.
              </p>
              {momoConfirmationError && (
                <p className="store-momo-confirm-error" role="alert">
                  {momoConfirmationError}
                </p>
              )}
              <div className="store-momo-confirm-actions">
                <button
                  type="button"
                  className="store-momo-confirm-cancel"
                  disabled={submitting}
                  onClick={() => {
                    setMomoConfirmationOpen(false);
                    setMomoConfirmationError('');
                  }}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  className="store-momo-confirm-submit"
                  onClick={handleMomoPaymentConfirmation}
                  disabled={submitting}
                >
                  {submitting ? 'Đang gửi đơn...' : 'Xác nhận & gửi đơn'}
                </button>
              </div>
            </section>
          </div>
        )}
        {momoOrder && momoSuccessOpen && (
          <div className="store-momo-confirm-backdrop">
            <section
              className="store-momo-confirm-dialog store-momo-success-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="store-momo-success-title"
            >
              <span className="store-momo-confirm-icon" aria-hidden="true">✓</span>
              <h2 id="store-momo-success-title">Đặt hàng thành công!</h2>
              <p>Cảm ơn bạn đã đặt đơn {displayOrder.orderNumber}.</p>
              <Link to="/products" className="store-momo-success-link">
                Về trang cửa hàng
              </Link>
            </section>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="store-cart-page">
      <div className="store-cart-container">
        <header className="store-cart-heading">
          <div>
            <span className="store-cart-eyebrow">NP FOOD</span>
            <h1>Giỏ hàng</h1>
            <p>Kiểm tra sản phẩm và điền thông tin nhận hàng.</p>
          </div>
          <Link to="/products" className="store-cart-back-link">← Tiếp tục mua sắm</Link>
        </header>

        {!cartHydrated ? (
          <div className="store-cart-empty">Đang kiểm tra sản phẩm trong giỏ...</div>
        ) : cartItems.length === 0 ? (
          <div className="store-cart-empty">
            <span>🛒</span>
            <h2>Giỏ hàng của bạn đang trống</h2>
            <p>Khám phá sản phẩm của cửa hàng và thêm món bạn yêu thích.</p>
            <Link to="/products" className="store-cart-primary">Khám phá sản phẩm</Link>
          </div>
        ) : (
          <div className="store-cart-layout">
            <section className="store-cart-items">
              <div className="store-cart-section-heading">
                <h2>Sản phẩm trong giỏ</h2>
                <span>{cartItems.reduce((sum, item) => sum + item.quantity, 0)} món</span>
              </div>
              {cartItems.map((item) => (
                <article className="store-cart-item" key={item.id}>
                  {item.imageUrl ? <img src={item.imageUrl} alt={item.name} /> : <span className="store-cart-item-placeholder">🥬</span>}
                  <div className="store-cart-item-info">
                    <h3>{item.name}</h3>
                    <div className="store-cart-item-price-block">
                      <p>{formatPrice(item.price)}</p>
                      {item.flashSale && Number(item.originalPrice) > Number(item.price) && (
                        <small>Flash Sale · giá gốc <del>{formatPrice(item.originalPrice)}</del></small>
                      )}
                    </div>
                    {Number(item.stock) < item.quantity && (
                      <small className="store-cart-stock-warning">Chỉ còn {item.stock} sản phẩm</small>
                    )}
                    <div className="store-cart-item-controls">
                      <label htmlFor={`quantity-${item.id}`}>Số lượng</label>
                      <input
                        id={`quantity-${item.id}`}
                        type="number"
                        min="1"
                        max={Math.max(1, Number(item.stock) || 1)}
                        value={item.quantity}
                        onChange={(event) => onUpdateQuantity(item.id, Number(event.target.value) || 1)}
                      />
                      <button type="button" onClick={() => onRemove(item.id)}>Xóa</button>
                    </div>
                  </div>
                  <strong className="store-cart-item-total">{formatPrice(Number(item.price) * item.quantity)}</strong>
                </article>
              ))}
              <button type="button" className="store-cart-clear" onClick={onClear}>Xóa toàn bộ giỏ hàng</button>
            </section>

            <aside className="store-checkout-card">
              {!authReady ? (
                <div className="store-checkout-auth-state">Đang kiểm tra tài khoản...</div>
              ) : !user ? (
                <div className="store-checkout-auth-required">
                  <span aria-hidden="true">👤</span>
                  <h2>Đăng nhập để đặt hàng</h2>
                  <p>Tạo tài khoản khách hàng để mua hàng và tích điểm cùng NP Food.</p>
                  <Link to="/register" state={{ from: '/cart' }} className="store-cart-primary">Đăng ký tài khoản</Link>
                  <Link to="/login" state={{ from: '/cart' }} className="store-cart-secondary">Đã có tài khoản? Đăng nhập</Link>
                </div>
              ) : (
                <>
              <div className="store-cart-section-heading">
                <h2>Thông tin nhận hàng</h2>
              </div>
              <DeliveryAddressPicker
                user={user}
                profile={customerProfile}
                profileLoading={customerProfileLoading}
                deliveryMethod={deliveryMethod}
                onDeliveryMethodChange={setDeliveryMethod}
                onAddressChange={handleAddressChange}
              />
              <form onSubmit={handleSubmit}>
                <div className="store-checkout-fields store-checkout-recipient">
                  <label>
                    Họ và tên
                    <input
                      type="text"
                      value={customer.name}
                      onChange={(event) => setCustomer({ ...customer, name: event.target.value })}
                      autoComplete="name"
                      required
                    />
                  </label>
                  <label>
                    Số điện thoại
                    <input
                      type="tel"
                      value={customer.phone}
                      onChange={(event) => setCustomer({ ...customer, phone: event.target.value })}
                      autoComplete="tel"
                      required
                    />
                  </label>
                </div>
                <div className="store-checkout-fields store-checkout-note">
                  <label>Ghi chú<textarea value={customer.note} onChange={(event) => setCustomer({ ...customer, note: event.target.value })} rows={2} placeholder="Thời gian nhận hàng hoặc lưu ý khác..." /></label>
                </div>
                <div className="store-checkout-voucher">
                  <span className="store-checkout-voucher-label">Mã giảm giá</span>
                  {voucherLoadError && <p role="alert">{voucherLoadError}</p>}
                  <button
                    type="button"
                    className="store-checkout-voucher-trigger"
                    onClick={() => {
                      setPendingVoucherId(selectedVoucherId);
                      setVoucherModalOpen(true);
                    }}
                  >
                    <span>
                      {selectedVoucher
                        ? `${selectedVoucher.code} · ${selectedVoucher.discountType === 'percent'
                          ? `Giảm ${Number(selectedVoucher.discountValue) || 0}%`
                          : `Giảm ${formatPrice(selectedVoucher.discountValue)}`}`
                        : 'Chọn voucher đã nhận'}
                    </span>
                    <span aria-hidden="true">›</span>
                  </button>
                  {selectedVoucher && (
                    <small>
                      {subtotal < (Number(selectedVoucher.minOrder) || 0)
                        ? `Đơn hàng cần từ ${formatPrice(selectedVoucher.minOrder)} để dùng voucher này.`
                        : `Đã áp dụng ${selectedVoucher.code}: giảm ${formatPrice(voucherDiscount)}.`}
                    </small>
                  )}
                </div>
                <div className="store-checkout-points">
                  <label className="store-checkout-points-toggle" htmlFor="store-checkout-use-points">
                    <input
                      id="store-checkout-use-points"
                      type="checkbox"
                      checked={usePoints}
                      onChange={(event) => setUsePoints(event.target.checked)}
                      disabled={customerProfileLoading || availablePoints === 0 || subtotal <= voucherDiscount}
                    />
                    <span>Dùng điểm tích lũy</span>
                    <strong>-{formatPrice(maximumPointsDiscount)}</strong>
                  </label>
                  <small>
                    {customerProfileLoading
                      ? 'Đang tải số điểm...'
                      : `Bạn có ${availablePoints.toLocaleString('vi-VN')} điểm · 1 điểm = 1 ₫`}
                  </small>
                </div>
                <div className="store-checkout-payment-options" role="radiogroup" aria-label="Phương thức thanh toán">
                  <label className={`store-checkout-payment ${paymentMethod === 'cash_on_delivery' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="cash_on_delivery"
                      checked={paymentMethod === 'cash_on_delivery'}
                      onChange={() => setPaymentMethod('cash_on_delivery')}
                    />
                    <span className="store-checkout-cod-icon">₫</span>
                    <span><strong>Thanh toán khi nhận hàng</strong><small>Trả tiền mặt khi nhận đơn.</small></span>
                  </label>
                  {paymentSettings.enabled && (
                    <label className={`store-checkout-payment ${paymentMethod === 'momo' ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="momo"
                        checked={paymentMethod === 'momo'}
                        onChange={() => setPaymentMethod('momo')}
                      />
                      <span className="store-checkout-momo-icon">M</span>
                      <span>
                        <strong>Thanh toán MoMo qua QR</strong>
                        <small>Xem mã QR; đơn chỉ gửi sau khi xác nhận chuyển khoản.</small>
                      </span>
                    </label>
                  )}
                </div>
                {paymentSettingsError && <p className="store-checkout-error" role="alert">{paymentSettingsError}</p>}
                {checkoutError && <p className="store-checkout-error" role="alert">{checkoutError}</p>}
                <div className="store-checkout-total">
                  <span>{totalDiscount > 0 ? 'Tổng tiền hàng' : 'Tổng thanh toán'}</span>
                  <strong>{formatPrice(subtotal)}</strong>
                </div>
                {voucherDiscount > 0 && (
                  <div className="store-checkout-discount">
                    <span>Voucher ({selectedVoucher.code})</span>
                    <strong>-{formatPrice(voucherDiscount)}</strong>
                  </div>
                )}
                {pointsDiscount > 0 && (
                  <div className="store-checkout-discount">
                    <span>Điểm tích lũy ({pointsDiscount.toLocaleString('vi-VN')} điểm)</span>
                    <strong>-{formatPrice(pointsDiscount)}</strong>
                  </div>
                )}
                {totalDiscount > 0 && (
                  <div className="store-checkout-total">
                    <span>Tổng thanh toán</span>
                    <strong>{formatPrice(totalAfterDiscount)}</strong>
                  </div>
                )}
                <p className="store-checkout-shipping">Phí giao hàng sẽ được cửa hàng xác nhận khi liên hệ.</p>
                <button
                  type="submit"
                  className="store-checkout-submit"
                  disabled={submitting || !cartHydrated || cartItems.length === 0}
                  aria-busy={submitting}
                >
                  {submitting && (
                    <span className="store-checkout-spinner" aria-hidden="true" />
                  )}
                  <span aria-live="polite">
                    {submitting
                      ? (paymentMethod === 'momo' ? 'Đang kiểm tra...' : 'Đang gửi đơn...')
                      : (paymentMethod === 'momo' ? 'Tiếp tục thanh toán MoMo' : 'Đặt hàng')}
                  </span>
                </button>
              </form>
                </>
              )}
            </aside>
          </div>
        )}
        {voucherModalOpen && (
          <div
            className="store-voucher-modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setVoucherModalOpen(false);
            }}
          >
            <section
              className="store-voucher-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="store-voucher-modal-title"
            >
              <header className="store-voucher-modal-header">
                <h2 id="store-voucher-modal-title">Sử dụng mã giảm giá</h2>
                <button
                  type="button"
                  aria-label="Đóng danh sách voucher"
                  onClick={() => setVoucherModalOpen(false)}
                >
                  ×
                </button>
              </header>
              <div className="store-voucher-modal-list">
                {voucherLoadError && <p className="store-voucher-modal-message" role="alert">{voucherLoadError}</p>}
                {voucherLoading && <p className="store-voucher-modal-empty">Đang tải voucher...</p>}
                {!voucherLoading && !voucherLoadError && voucherModalItems.length === 0 && (
                  <p className="store-voucher-modal-empty">
                    Bạn chưa nhận voucher nào. <Link to="/vouchers" onClick={() => setVoucherModalOpen(false)}>Xem voucher</Link>
                  </p>
                )}
                {!voucherLoading && voucherModalItems.map((voucher) => {
                    const isSelected = pendingVoucherId === voucher.voucherId;
                    return (
                      <article
                        className={`store-voucher-option ${voucher.usable ? '' : 'is-unavailable'} ${isSelected ? 'is-selected' : ''}`}
                        key={voucher.voucherId}
                      >
                        <div className="store-voucher-option-mark" aria-hidden="true">%</div>
                        <div className="store-voucher-option-content">
                          <strong>
                            {voucher.discountType === 'percent'
                              ? `Giảm ${Number(voucher.discountValue) || 0}%`
                              : `Giảm ${formatPrice(voucher.discountValue)}`}
                          </strong>
                          <span>{voucher.name ? `${voucher.name} · ${voucher.code}` : voucher.code}</span>
                          <small>
                            {Number(voucher.minOrder) > 0
                              ? `Đơn từ ${formatPrice(voucher.minOrder)}`
                              : 'Không yêu cầu giá trị đơn tối thiểu'}
                          </small>
                          {voucher.expiresAt && Number.isFinite(new Date(voucher.expiresAt).getTime()) && (
                            <small>Hạn sử dụng: {new Date(voucher.expiresAt).toLocaleDateString('vi-VN')}</small>
                          )}
                          {voucher.unavailableReason && (
                            <small className="store-voucher-option-reason">{voucher.unavailableReason}</small>
                          )}
                        </div>
                        <button
                          type="button"
                          className="store-voucher-option-select"
                          disabled={!voucher.usable}
                          aria-label={isSelected ? `Bỏ chọn voucher ${voucher.code}` : `Chọn voucher ${voucher.code}`}
                          aria-pressed={isSelected}
                          onClick={() => setPendingVoucherId(isSelected ? '' : voucher.voucherId)}
                        >
                          {isSelected ? '✓' : '+'}
                        </button>
                      </article>
                    );
                  })}
              </div>
              <footer className="store-voucher-modal-footer">
                <button
                  type="button"
                  className="store-voucher-modal-clear"
                  onClick={() => {
                    setSelectedVoucherId('');
                    setPendingVoucherId('');
                    setVoucherModalOpen(false);
                  }}
                >
                  Bỏ voucher
                </button>
                <button
                  type="button"
                  className="store-voucher-modal-confirm"
                  disabled={Boolean(pendingVoucherId) && !pendingVoucher?.usable}
                  onClick={() => {
                    setSelectedVoucherId(pendingVoucherId);
                    setVoucherModalOpen(false);
                  }}
                >
                  Xác nhận
                </button>
              </footer>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default Cart;
