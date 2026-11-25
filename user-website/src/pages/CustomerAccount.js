import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  claimCustomerVoucher,
  getAvailableVouchers,
  getCustomerOrders,
  getCustomerVoucherClaims,
  getProductImages
} from '../services/dataService';
import {
  changeCustomerPassword,
  registerCustomerAccount,
  confirmCustomerPhoneCode,
  createCustomerPhoneVerifier,
  getCustomerProfile,
  sendCustomerPhoneCode,
  signInWithFacebook,
  signInWithGoogle,
  signInCustomer,
  signOutCustomer
} from '../services/customerAuthService';
import '../css/CustomerAccount.css';

const getAuthMessage = (error) => {
  const messages = {
    'auth/email-already-in-use': 'Email này đã được đăng ký. Hãy đăng nhập để tiếp tục.',
    'auth/invalid-email': 'Địa chỉ email chưa hợp lệ.',
    'auth/invalid-credential': 'Email hoặc mật khẩu không chính xác.',
    'auth/account-exists-with-different-credential': 'Email này đã dùng phương thức đăng nhập khác. Hãy đăng nhập bằng phương thức ban đầu.',
    'auth/popup-closed-by-user': 'Bạn đã đóng cửa sổ đăng nhập trước khi hoàn tất.',
    'auth/unauthorized-domain': 'Tên miền website chưa được thêm vào danh sách cho phép trong Firebase Authentication.',
    'auth/weak-password': 'Mật khẩu cần có ít nhất 6 ký tự.',
    'auth/wrong-password': 'Mật khẩu hiện tại chưa chính xác.',
    'auth/requires-recent-login': 'Vì lý do bảo mật, hãy đăng nhập lại rồi đổi mật khẩu.',
    'auth/invalid-phone-number': 'Số điện thoại chưa đúng định dạng.',
    'auth/invalid-verification-code': 'Mã SMS không chính xác.',
    'auth/code-expired': 'Mã SMS đã hết hạn. Hãy gửi mã mới.',
    'auth/too-many-requests': 'Bạn đã yêu cầu quá nhiều lần. Vui lòng thử lại sau.',
    'auth/captcha-check-failed': 'Xác minh reCAPTCHA thất bại. Hãy thử lại.',
    'auth/operation-not-allowed': 'Firebase không cho phép gửi SMS. Hãy kiểm tra Phone đã bật trong đúng project và SMS region policy có cho phép Việt Nam (+84).'
  };
  return messages[error.code] || error.message || 'Không thể thực hiện yêu cầu. Vui lòng thử lại.';
};

const orderFilters = [
  { value: 'all', label: 'Tất cả' },
  { value: 'receiving', label: 'Đang tiếp nhận' },
  { value: 'shipping', label: 'Đang giao' },
  { value: 'delivered', label: 'Đã giao' },
  { value: 'cancelled', label: 'Đã hủy' }
];

const orderStatusLabels = {
  pending: 'Đang tiếp nhận',
  processing: 'Đang tiếp nhận',
  shipped: 'Đang giao',
  delivered: 'Đã giao',
  cancelled: 'Đã hủy'
};

const getOrderItems = (items) => {
  if (Array.isArray(items)) return items;
  if (items && typeof items === 'object') return Object.values(items);
  return [];
};

const getOrderItemImage = (item, productImages) => {
  if (!item || typeof item !== 'object') return '';
  return item.imageUrl || item.imageURL || item.image || item.thumbnailUrl ||
    item.productImage || item.imageUrls?.[0] ||
    productImages[item.productId] || '';
};

const getOrderItemName = (item) => (
  typeof item === 'string'
    ? item
    : item?.name || item?.productName || 'Sản phẩm'
);

const formatOrderDate = (order) => {
  const date = new Date(order.createdAt || order.orderDate || 0);
  return Number.isNaN(date.getTime()) || date.getTime() === 0
    ? 'Chưa có ngày đặt'
    : date.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
};

const formatOrderTotal = (order) => (
  Number(order.totalAmount ?? order.total ?? order.amount ?? 0).toLocaleString('vi-VN')
);

const formatCurrency = (amount) => `${Number(amount || 0).toLocaleString('vi-VN')}₫`;

const OrderDetailView = ({
  order,
  productImages,
  productImagesError,
  onBack,
  onCopy,
  copyFeedback
}) => {
  const rawStatus = String(order.status || 'pending').toLowerCase();
  const status = orderStatusLabels[rawStatus] ? rawStatus : 'pending';
  const items = getOrderItems(order.items);
  const customer = order.customer || {};
  const address = customer.address || order.shippingAddress || order.address || '';
  const isPaid = order.isPaid === true || order.paid === true ||
    ['paid', 'completed'].includes(String(order.paymentStatus || '').toLowerCase());
  const paymentMethod = order.paymentMethod === 'cash_on_delivery'
    ? 'Thanh toán khi nhận hàng'
    : order.paymentMethod === 'momo'
      ? 'Thanh toán MoMo qua QR'
      : order.paymentMethod || 'Thanh toán khi nhận hàng';
  const subtotal = order.subtotalAmount ?? order.subtotal;
  const shippingFee = order.shippingFee ?? order.deliveryFee;
  const voucherDiscount = Number(order.voucherDiscountAmount) || 0;
  const pointsDiscount = Number(order.pointsDiscountAmount) ||
    Number(order.pointsRedeemed) || 0;
  const otherDiscount = Math.max(
    0,
    (Number(order.discountAmount) || 0) - voucherDiscount - pointsDiscount
  );

  return (
    <div className="store-account-order-detail-view">
      <header className="store-account-order-detail-title">
        <button type="button" onClick={onBack} aria-label="Quay lại danh sách đơn hàng">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <h2 id="store-account-orders-title">Chi tiết đơn hàng</h2>
      </header>

      <div className="store-account-order-detail-top">
        <section className="store-account-order-detail-card">
          <h3>Thông tin người nhận</h3>
          <p>
            {[customer.name || order.customerName, customer.phone || order.phone]
              .filter(Boolean)
              .join(' - ') || 'Chưa có thông tin người nhận'}
          </p>
          {address && <p>{address}</p>}
          {order.deliveryMethod === 'pickup' && <p>Nhận tại cửa hàng</p>}
        </section>

        <section className="store-account-order-detail-card">
          <div className="store-account-order-detail-meta-heading">
            <h3>Đơn hàng:</h3>
            <span className={`store-account-order-status store-account-order-status--${status}`}>
              {orderStatusLabels[status]}
            </span>
          </div>
          <div className="store-account-order-number-row">
            <strong>#{order.orderNumber || order.id}</strong>
            <button
              type="button"
              className="store-account-order-copy"
              aria-label={`Sao chép mã đơn #${order.orderNumber || order.id}`}
              onClick={onCopy}
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
          {copyFeedback && (
            <small className="store-account-order-copy-feedback" role="status">
              {copyFeedback}
            </small>
          )}
          {(order.cancelReason || order.cancellationReason) && (
            <p className="store-account-order-cancel-reason">
              <strong>Lý do hủy:</strong> {order.cancelReason || order.cancellationReason}
            </p>
          )}
          <p>Đặt lúc: {formatOrderDate(order)}</p>
        </section>
      </div>

      <section className="store-account-order-detail-card store-account-order-payment">
        <h3>Hình thức thanh toán</h3>
        <p>{paymentMethod}</p>
        <p className={isPaid ? 'is-paid' : 'is-unpaid'}>
          {isPaid
            ? 'Đơn hàng đã được thanh toán'
            : 'Đơn hàng chưa được thanh toán'}
        </p>
      </section>

      <section className="store-account-order-detail-card store-account-order-products">
        <h3>Thông tin sản phẩm</h3>
        {order.deliveryTime && <p>Nhận: {order.deliveryTime}</p>}
        {productImagesError && items.some((item) => !getOrderItemImage(item, productImages)) && (
          <p className="store-account-order-image-error" role="status">
            Chưa tải được ảnh của một số sản phẩm.
          </p>
        )}
        <ul>
          {items.map((item, index) => {
            const itemData = item && typeof item === 'object' ? item : {};
            const imageUrl = getOrderItemImage(itemData, productImages);
            const itemName = getOrderItemName(item);
            const quantity = Number(itemData.quantity || itemData.qty || 1);
            const price = Number(itemData.price || 0);
            return (
              <li key={`${itemData.productId || itemName}-${index}`}>
                {imageUrl ? (
                  <img src={imageUrl} alt={itemName} loading="lazy" />
                ) : (
                  <span className="store-account-order-detail-image-placeholder" aria-hidden="true">▣</span>
                )}
                <div>
                  <strong>{itemName}</strong>
                  {(itemData.variant || itemData.color || itemData.size) && (
                    <span>{itemData.variant || itemData.color || itemData.size}</span>
                  )}
                  <span>{quantity} × {formatCurrency(price)}</span>
                </div>
                <strong>{formatCurrency(quantity * price)}</strong>
              </li>
            );
          })}
        </ul>
        {order.note && <p>Ghi chú: {order.note}</p>}
      </section>

      <section className="store-account-order-detail-card store-account-order-totals">
        <h3>Chi tiết thanh toán</h3>
        {subtotal != null && <p><span>Tổng tiền hàng</span><strong>{formatCurrency(subtotal)}</strong></p>}
        {(shippingFee != null || order.deliveryMethod === 'delivery') && (
          <p>
            <span>Phí giao hàng</span>
            <strong>{Number(shippingFee) > 0 ? formatCurrency(shippingFee) : 'Miễn phí'}</strong>
          </p>
        )}
        {voucherDiscount > 0 && (
          <p><span>Giảm giá voucher</span><strong>-{formatCurrency(voucherDiscount)}</strong></p>
        )}
        {pointsDiscount > 0 && (
          <p><span>Giảm bằng điểm</span><strong>-{formatCurrency(pointsDiscount)}</strong></p>
        )}
        {otherDiscount > 0 && (
          <p><span>Giảm giá</span><strong>-{formatCurrency(otherDiscount)}</strong></p>
        )}
        <p className="store-account-order-grand-total">
          <span>Tổng thanh toán</span>
          <strong>{formatCurrency(order.totalAmount ?? order.total ?? order.amount)}</strong>
        </p>
      </section>
    </div>
  );
};

const toDateInputValue = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getPreviousYearDateInput = () => {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 1);
  return toDateInputValue(date);
};

const formatOrderRangeDate = (value) => {
  if (!value) return '...';
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('vi-VN');
};

const formatPoints = (points) => (Number(points) || 0).toLocaleString('vi-VN');

const formatVoucherDiscount = (voucher) => (
  voucher.discountType === 'percent'
    ? `Giảm ${Number(voucher.discountValue) || 0}%`
    : `Giảm ${Number(voucher.discountValue || 0).toLocaleString('vi-VN')}₫`
);

const isVoucherExpired = (voucher) => (
  Boolean(voucher.expiresAt) && new Date(voucher.expiresAt).getTime() <= Date.now()
);

const CustomerAccount = ({ user, authReady, onAuthenticated }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const mode = location.pathname === '/login'
    ? 'login'
    : location.pathname === '/account' ? 'account' : 'register';
  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [socialProvider, setSocialProvider] = useState('');
  const [phoneStep, setPhoneStep] = useState('closed');
  const [phoneForm, setPhoneForm] = useState({ name: '', phone: '', code: '' });
  const [phoneConfirmation, setPhoneConfirmation] = useState(null);
  const [phoneNotice, setPhoneNotice] = useState('');
  const [accountSection, setAccountSection] = useState(
    location.state?.accountSection === 'vouchers' ? 'vouchers' : 'orders'
  );
  const [orders, setOrders] = useState([]);
  const [orderProductImages, setOrderProductImages] = useState({});
  const [orderProductImagesError, setOrderProductImagesError] = useState('');
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState('');
  const [ordersRetryKey, setOrdersRetryKey] = useState(0);
  const [orderFilter, setOrderFilter] = useState('all');
  const [orderDateFrom, setOrderDateFrom] = useState(getPreviousYearDateInput);
  const [orderDateTo, setOrderDateTo] = useState(() => toDateInputValue(new Date()));
  const [orderDateEditorOpen, setOrderDateEditorOpen] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [orderCopyFeedback, setOrderCopyFeedback] = useState({ orderId: '', message: '' });
  const [customerVouchers, setCustomerVouchers] = useState([]);
  const [availableVoucherOffers, setAvailableVoucherOffers] = useState([]);
  const [customerVouchersLoading, setCustomerVouchersLoading] = useState(false);
  const [customerVouchersError, setCustomerVouchersError] = useState('');
  const [voucherClaimNotice, setVoucherClaimNotice] = useState('');
  const [claimingAccountVoucherId, setClaimingAccountVoucherId] = useState('');
  const [voucherFilter, setVoucherFilter] = useState('unclaimed');
  const [customerProfile, setCustomerProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordNotice, setPasswordNotice] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const phoneVerifier = useRef(null);

  useEffect(() => {
    if (mode !== 'account' || !user?.uid) return undefined;

    let active = true;
    setOrdersLoading(true);
    setOrdersError('');
    setOrders([]);
    getCustomerOrders(user.uid)
      .then((customerOrders) => {
        if (active) setOrders(customerOrders);
      })
      .catch((orderError) => {
        console.error('Không thể tải lịch sử đơn hàng:', orderError);
        if (active) {
          const errorDetails = `${orderError?.code || ''} ${orderError?.message || ''}`.toLowerCase();
          if (errorDetails.includes('permission')) {
            setOrdersError(
              'Firebase từ chối đọc đơn hàng. Hãy publish database.rules.json (quyền đọc và index customerUid) lên đúng project rồi thử lại.'
            );
          } else if (errorDetails.includes('index')) {
            setOrdersError(
              'Firebase chưa có index customerUid cho đơn hàng. Hãy publish database.rules.json lên đúng project rồi thử lại.'
            );
          } else {
            setOrdersError(
              `Không thể tải lịch sử đơn hàng${orderError?.code ? ` (${orderError.code})` : ''}. Vui lòng thử lại.`
            );
          }
        }
      })
      .finally(() => {
        if (active) setOrdersLoading(false);
      });

    return () => {
      active = false;
    };
  }, [mode, user?.uid, ordersRetryKey]);

  useEffect(() => {
    if (mode !== 'account' || !user?.uid) return undefined;

    let active = true;
    setOrderProductImagesError('');
    getProductImages()
      .then((images) => {
        if (active) setOrderProductImages(images);
      })
      .catch((imageError) => {
        console.error('Không thể tải ảnh sản phẩm trong đơn hàng:', imageError);
        if (active) setOrderProductImagesError('Không thể tải ảnh sản phẩm.');
      });

    return () => {
      active = false;
    };
  }, [mode, user?.uid]);

  useEffect(() => {
    if (mode !== 'account' || !user?.uid) return undefined;

    let active = true;
    setCustomerVouchersLoading(true);
    setCustomerVouchersError('');
    Promise.all([
      getCustomerVoucherClaims(user.uid),
      getAvailableVouchers()
    ])
      .then(([claims, offers]) => {
        if (!active) return;
        setCustomerVouchers(claims);
        setAvailableVoucherOffers(offers);
      })
      .catch((claimsError) => {
        console.error('Không thể tải Kho voucher:', claimsError);
        if (active) setCustomerVouchersError('Không thể tải Kho voucher. Vui lòng kiểm tra Firebase Database Rules.');
      })
      .finally(() => {
        if (active) setCustomerVouchersLoading(false);
      });

    return () => { active = false; };
  }, [mode, user?.uid]);

  useEffect(() => {
    if (mode !== 'account' || !user?.uid) return undefined;

    let active = true;
    setProfileLoading(true);
    setProfileError('');
    getCustomerProfile(user.uid)
      .then((profile) => {
        if (active) setCustomerProfile(profile);
      })
      .catch((profileFetchError) => {
        console.error('Không thể tải hồ sơ khách hàng:', profileFetchError);
        if (active) setProfileError('Không thể tải hồ sơ tài khoản. Vui lòng thử tải lại trang.');
      })
      .finally(() => {
        if (active) setProfileLoading(false);
      });

    return () => {
      active = false;
    };
  }, [mode, user?.uid]);

  useLayoutEffect(() => {
    return () => {
      phoneVerifier.current?.clear();
      phoneVerifier.current = null;
    };
  }, []);

  if (!authReady && mode === 'account') {
    return <div className="store-account-state">Đang kiểm tra tài khoản...</div>;
  }
  if (mode === 'account' && !user) return <Navigate to="/login" replace />;
  if ((mode === 'login' || mode === 'register') && user) return <Navigate to="/account" replace />;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (mode === 'register' && form.password !== form.confirmPassword) {
      setError('Mật khẩu xác nhận chưa khớp.');
      return;
    }

    setSubmitting(true);
    try {
      const authenticatedUser = mode === 'register'
        ? await registerCustomerAccount(form)
        : await signInCustomer(form.email, form.password);
      onAuthenticated(authenticatedUser);
      navigate(location.state?.from || '/account', { replace: true });
    } catch (submitError) {
      console.error('Lỗi khi xử lý tài khoản khách hàng:', submitError);
      setError(getAuthMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    setError('');
    setSubmitting(true);
    try {
      await signOutCustomer();
      onAuthenticated(null);
      navigate('/', { replace: true });
    } catch (signOutError) {
      console.error('Không thể đăng xuất tài khoản khách hàng:', signOutError);
      setError(getAuthMessage(signOutError));
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();
    setPasswordError('');
    setPasswordNotice('');
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Mật khẩu mới xác nhận chưa khớp.');
      return;
    }

    setChangingPassword(true);
    try {
      await changeCustomerPassword(user, passwordForm.currentPassword, passwordForm.newPassword);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordNotice('Mật khẩu đã được cập nhật.');
    } catch (passwordChangeError) {
      console.error('Không thể đổi mật khẩu tài khoản:', passwordChangeError);
      setPasswordError(getAuthMessage(passwordChangeError));
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSocialSignIn = async (providerName) => {
    setError('');
    setSubmitting(true);
    setSocialProvider(providerName);
    try {
      const authenticatedUser = providerName === 'google'
        ? await signInWithGoogle()
        : await signInWithFacebook();
      onAuthenticated(authenticatedUser);
      navigate(location.state?.from || '/account', { replace: true });
    } catch (socialError) {
      console.error(`Lỗi đăng nhập ${providerName}:`, socialError);
      setError(getAuthMessage(socialError));
    } finally {
      setSocialProvider('');
      setSubmitting(false);
    }
  };

  const handleSendPhoneCode = async (event) => {
    event.preventDefault();
    setError('');
    setPhoneNotice('');
    setSubmitting(true);
    try {
      if (!phoneVerifier.current) {
        phoneVerifier.current = createCustomerPhoneVerifier();
      }
      const result = await sendCustomerPhoneCode(phoneForm.phone, phoneVerifier.current);
      setPhoneForm((current) => ({ ...current, phone: result.phoneNumber }));
      setPhoneConfirmation(result.confirmation);
      setPhoneStep('code');
      setPhoneNotice(`Mã xác minh đã gửi đến ${result.phoneNumber}.`);
    } catch (phoneError) {
      console.error('Không thể gửi mã xác minh điện thoại:', phoneError);
      setError(getAuthMessage(phoneError));
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyPhoneCode = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const authenticatedUser = await confirmCustomerPhoneCode(
        phoneConfirmation,
        phoneForm.code,
        phoneForm.name
      );
      onAuthenticated(authenticatedUser);
      navigate(location.state?.from || '/account', { replace: true });
    } catch (phoneError) {
      console.error('Không thể xác minh tài khoản bằng điện thoại:', phoneError);
      setError(getAuthMessage(phoneError));
    } finally {
      setSubmitting(false);
    }
  };

  const returnToAccountOptions = () => {
    phoneVerifier.current?.clear();
    phoneVerifier.current = null;
    setPhoneStep('closed');
    setPhoneConfirmation(null);
    setPhoneNotice('');
    setError('');
  };

  const handleCopyOrderNumber = async (order) => {
    const orderNumber = `#${order.orderNumber || order.id}`;
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Trình duyệt không hỗ trợ sao chép.');
      }
      await navigator.clipboard.writeText(orderNumber);
      setOrderCopyFeedback({ orderId: order.id, message: 'Đã sao chép mã đơn.' });
    } catch (copyError) {
      console.error('Không thể sao chép mã đơn hàng:', copyError);
      setOrderCopyFeedback({ orderId: order.id, message: 'Không thể sao chép mã đơn.' });
    }
  };

  const handleClaimAccountVoucher = async (voucher) => {
    if (!user?.uid) return;
    setCustomerVouchersError('');
    setVoucherClaimNotice('');
    setClaimingAccountVoucherId(voucher.id);
    try {
      const claim = await claimCustomerVoucher(user.uid, voucher.id);
      setCustomerVouchers((current) => [...current, { ...claim, id: voucher.id }]);
      setVoucherClaimNotice(`Đã lưu voucher ${voucher.code} vào mục Đã lấy.`);
    } catch (claimError) {
      console.error('Không thể lấy voucher trong tài khoản:', claimError);
      setCustomerVouchersError(claimError.message || 'Không thể lưu voucher. Vui lòng thử lại.');
    } finally {
      setClaimingAccountVoucherId('');
    }
  };

  const hasPasswordProvider = user?.providerData?.some(
    (provider) => provider.providerId === 'password'
  );
  const accountName = customerProfile?.name || user?.displayName;
  const selectedOrder = orders.find((order) => order.id === expandedOrderId);
  const orderStartTimestamp = orderDateFrom
    ? new Date(`${orderDateFrom}T00:00:00`).getTime()
    : -Infinity;
  const orderEndTimestamp = orderDateTo
    ? new Date(`${orderDateTo}T23:59:59.999`).getTime()
    : Infinity;
  const visibleOrders = orders.filter((order) => {
    const status = String(order.status || 'pending').toLowerCase();
    const matchesStatus = orderFilter === 'all' ||
      (orderFilter === 'receiving' && (status === 'pending' || status === 'processing')) ||
      (orderFilter === 'shipping' && status === 'shipped') ||
      (orderFilter !== 'receiving' && orderFilter !== 'shipping' &&
        orderFilter !== 'all' && status === orderFilter);
    if (!matchesStatus) return false;

    const orderTimestamp = new Date(order.createdAt || order.orderDate || 0).getTime();
    return !Number.isFinite(orderTimestamp) ||
      (orderTimestamp >= orderStartTimestamp && orderTimestamp <= orderEndTimestamp);
  });
  const claimedVoucherIds = new Set(
    customerVouchers.map((voucher) => voucher.voucherId || voucher.id)
  );
  const unclaimedVouchers = availableVoucherOffers.filter((voucher) => (
    !claimedVoucherIds.has(voucher.id) &&
    (voucher.audienceType !== 'tier' ||
      (customerProfile?.tier && voucher.targetTier === customerProfile.tier))
  ));
  const claimedVouchers = customerVouchers.filter((voucher) => voucher.status !== 'redeemed');
  const usedVouchers = customerVouchers.filter((voucher) => voucher.status === 'redeemed');
  const visibleClaimedVouchers = voucherFilter === 'used' ? usedVouchers : claimedVouchers;

  if (mode === 'account') {
    return (
      <div className="store-account-page store-account-page--dashboard">
        <div className="store-account-dashboard">
          <aside className="store-account-sidebar">
            <section className="store-account-member-card">
              <span className="store-account-eyebrow">THÀNH VIÊN NP FOOD</span>
              <h2>{accountName || 'Khách hàng'}</h2>
              <p>{customerProfile?.phone || user.phoneNumber || 'Chưa cập nhật số điện thoại'}</p>
              <div className="store-account-member-points">
                <span>Tổng điểm tích lũy</span>
                <strong>{formatPoints(customerProfile?.points)} điểm</strong>
                <small>Hạng {customerProfile?.tier || 'Đồng'}</small>
              </div>
            </section>
            <nav className="store-account-sidebar-nav" aria-label="Tài khoản khách hàng">
              <button
                type="button"
                className={accountSection === 'orders' ? 'active' : ''}
                aria-pressed={accountSection === 'orders'}
                onClick={() => {
                  setExpandedOrderId(null);
                  setAccountSection('orders');
                }}
              >
                <span aria-hidden="true">▤</span>
                Đơn hàng đã mua
              </button>
              <button
                type="button"
                className={accountSection === 'vouchers' ? 'active' : ''}
                aria-pressed={accountSection === 'vouchers'}
                onClick={() => {
                  setExpandedOrderId(null);
                  setAccountSection('vouchers');
                }}
              >
                <span aria-hidden="true">%</span>
                Kho voucher
                <small>{customerVouchers.length}</small>
              </button>
              <button
                type="button"
                className={accountSection === 'profile' ? 'active' : ''}
                aria-pressed={accountSection === 'profile'}
                onClick={() => {
                  setExpandedOrderId(null);
                  setAccountSection('profile');
                }}
              >
                <span aria-hidden="true">♙</span>
                Thông tin của tôi
              </button>
            </nav>
            <div className="store-account-sidebar-actions">
              <Link to="/products">Tiếp tục mua sắm</Link>
              <button type="button" onClick={handleSignOut} disabled={submitting}>
                {submitting ? 'Đang đăng xuất...' : 'Đăng xuất'}
              </button>
            </div>
          </aside>

          <section className="store-account-content" aria-label="Nội dung tài khoản">
            {accountSection === 'orders' ? (
              <section aria-labelledby="store-account-orders-title">
                {expandedOrderId && selectedOrder ? (
                  <OrderDetailView
                    order={selectedOrder}
                    productImages={orderProductImages}
                    productImagesError={orderProductImagesError}
                    onBack={() => setExpandedOrderId(null)}
                    onCopy={() => handleCopyOrderNumber(selectedOrder)}
                    copyFeedback={orderCopyFeedback.orderId === selectedOrder.id
                      ? orderCopyFeedback.message
                      : ''}
                  />
                ) : (
                  <>
                <div className="store-account-content-heading store-account-orders-header">
                  <div>
                    <h1 id="store-account-orders-title">Đơn hàng đã mua</h1>
                    <p>Theo dõi trạng thái các đơn hàng của bạn</p>
                  </div>
                  <div className="store-account-order-date-control">
                    <span>Thời gian</span>
                    <strong>
                      {formatOrderRangeDate(orderDateFrom)} - {formatOrderRangeDate(orderDateTo)}
                    </strong>
                    <button
                      type="button"
                      aria-expanded={orderDateEditorOpen}
                      onClick={() => setOrderDateEditorOpen((open) => !open)}
                    >
                      Đổi
                    </button>
                  </div>
                </div>
              {orderDateEditorOpen && (
                <div className="store-account-order-date-editor">
                  <label>
                    Từ ngày
                    <input
                      type="date"
                      value={orderDateFrom}
                      max={orderDateTo || undefined}
                      onChange={(event) => setOrderDateFrom(event.target.value)}
                    />
                  </label>
                  <label>
                    Đến ngày
                    <input
                      type="date"
                      value={orderDateTo}
                      min={orderDateFrom || undefined}
                      max={toDateInputValue(new Date())}
                      onChange={(event) => setOrderDateTo(event.target.value)}
                    />
                  </label>
                  <button type="button" onClick={() => setOrderDateEditorOpen(false)}>
                    Xong
                  </button>
                </div>
              )}
              <div className="store-account-order-filters" role="group" aria-label="Lọc đơn hàng">
                {orderFilters.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    className={orderFilter === filter.value ? 'active' : ''}
                    aria-pressed={orderFilter === filter.value}
                    onClick={() => setOrderFilter(filter.value)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
              {ordersLoading ? (
                <p className="store-account-orders-message">Đang tải đơn hàng...</p>
              ) : ordersError ? (
                <div className="store-account-error store-account-order-error" role="alert">
                  <span>{ordersError}</span>
                  <button
                    type="button"
                    onClick={() => setOrdersRetryKey((current) => current + 1)}
                  >
                    Thử lại
                  </button>
                </div>
              ) : visibleOrders.length === 0 ? (
                <p className="store-account-orders-message">
                  {orders.length === 0
                    ? 'Bạn chưa có đơn hàng nào.'
                    : 'Không có đơn hàng phù hợp với bộ lọc hiện tại.'}
                </p>
              ) : (
                <div className="store-account-order-list">
                  {visibleOrders.map((order) => {
                    const rawStatus = String(order.status || 'pending').toLowerCase();
                    const status = orderStatusLabels[rawStatus] ? rawStatus : 'pending';
                    const items = getOrderItems(order.items);
                    const firstItem = items[0] && typeof items[0] === 'object' ? items[0] : {};
                    const firstItemName = getOrderItemName(items[0]);
                    const firstItemImage = getOrderItemImage(firstItem, orderProductImages);
                    return (
                      <article className="store-account-order" key={order.id}>
                        <div className="store-account-order-heading">
                          <div>
                            <span>Đơn hàng:</span>
                            <div className="store-account-order-number-row">
                              <strong>#{order.orderNumber || order.id}</strong>
                              <button
                                type="button"
                                className="store-account-order-copy"
                                aria-label={`Sao chép mã đơn #${order.orderNumber || order.id}`}
                                title="Sao chép mã đơn"
                                onClick={() => handleCopyOrderNumber(order)}
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
                            {orderCopyFeedback.orderId === order.id && (
                              <small className="store-account-order-copy-feedback" role="status">
                                {orderCopyFeedback.message}
                              </small>
                            )}
                            <time>Ngày đặt: {formatOrderDate(order)}</time>
                          </div>
                          <span className={`store-account-order-status store-account-order-status--${status}`}>
                            {orderStatusLabels[status]}
                          </span>
                        </div>
                        <div className="store-account-order-summary">
                          {firstItemImage ? (
                            <img
                              className="store-account-order-product-image"
                              src={firstItemImage}
                              alt={firstItemName}
                              loading="lazy"
                            />
                          ) : (
                            <span className="store-account-order-product-icon" aria-hidden="true">▣</span>
                          )}
                          <div>
                            <p>{firstItemName}</p>
                            {items.length > 1 && <span>+{items.length - 1} sản phẩm khác</span>}
                            <strong>Tổng tiền hàng: {formatOrderTotal(order)}₫</strong>
                          </div>
                        </div>
                        <div className="store-account-order-footer">
                          <span />
                          <button
                            type="button"
                            onClick={() => setExpandedOrderId(order.id)}
                            aria-label={`Xem chi tiết đơn #${order.orderNumber || order.id}`}
                          >
                            <svg
                              aria-hidden="true"
                              viewBox="0 0 24 24"
                              width="18"
                              height="18"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                            <span>Xem chi tiết</span>
                            <svg
                              aria-hidden="true"
                              viewBox="0 0 24 24"
                              width="15"
                              height="15"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="m9 18 6-6-6-6" />
                            </svg>
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
                  </>
                )}
              </section>
            ) : accountSection === 'vouchers' ? (
              <section aria-labelledby="store-account-vouchers-title">
                <header className="store-account-voucher-heading">
                  <button
                    type="button"
                    aria-label="Quay lại đơn hàng"
                    onClick={() => setAccountSection('orders')}
                  >
                    ‹
                  </button>
                  <h1 id="store-account-vouchers-title">KHO VOUCHER</h1>
                </header>
                <div className="store-account-voucher-tabs" role="tablist" aria-label="Lọc voucher">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={voucherFilter === 'unclaimed'}
                    className={voucherFilter === 'unclaimed' ? 'active' : ''}
                    onClick={() => setVoucherFilter('unclaimed')}
                  >
                    Chưa lấy ({unclaimedVouchers.length})
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={voucherFilter === 'claimed'}
                    className={voucherFilter === 'claimed' ? 'active' : ''}
                    onClick={() => setVoucherFilter('claimed')}
                  >
                    Đã lấy ({claimedVouchers.length})
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={voucherFilter === 'used'}
                    className={voucherFilter === 'used' ? 'active' : ''}
                    onClick={() => setVoucherFilter('used')}
                  >
                    Đã sử dụng ({usedVouchers.length})
                  </button>
                </div>
                {customerVouchersLoading ? (
                  <p className="store-account-orders-message">Đang tải Kho voucher...</p>
                ) : customerVouchersError ? (
                  <p className="store-account-error" role="alert">{customerVouchersError}</p>
                ) : voucherFilter === 'unclaimed' ? (
                  unclaimedVouchers.length === 0 ? (
                    <div className="store-account-voucher-empty" role="status">
                      <div className="store-account-voucher-empty-art" aria-hidden="true">🎟️</div>
                      <strong>Bạn đã lấy hết mã hiện có!</strong>
                      <button type="button" onClick={() => setVoucherFilter('claimed')}>
                        Xem mã đã lấy <span aria-hidden="true">›</span>
                      </button>
                    </div>
                  ) : (
                    <div className="store-account-voucher-grid">
                      {unclaimedVouchers.map((voucher) => (
                        <article className="store-account-voucher-card" key={voucher.id}>
                          <span className="store-account-voucher-icon">
                            <img src="/logo.png" alt="NP Food" />
                          </span>
                          <div className="store-account-voucher-details">
                            <strong>{formatVoucherDiscount(voucher)}</strong>
                            <p>{voucher.name || 'Ưu đãi NP Food'}</p>
                            <small>
                              {Number(voucher.minOrder) > 0
                                ? `Đơn từ ${Number(voucher.minOrder).toLocaleString('vi-VN')}₫`
                                : 'Không yêu cầu đơn tối thiểu'}
                            </small>
                            {voucher.expiresAt && (
                              <small>Hạn sử dụng: {new Date(voucher.expiresAt).toLocaleDateString('vi-VN')}</small>
                            )}
                            <button
                              type="button"
                              onClick={() => handleClaimAccountVoucher(voucher)}
                              disabled={Boolean(claimingAccountVoucherId)}
                            >
                              {claimingAccountVoucherId === voucher.id ? 'Đang lấy...' : 'Lấy voucher'}
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  )
                ) : (
                  visibleClaimedVouchers.length === 0 ? (
                    <div className="store-account-voucher-empty" role="status">
                      <div className="store-account-voucher-empty-art" aria-hidden="true">🎟️</div>
                      <strong>
                        {voucherFilter === 'used'
                          ? 'Bạn chưa sử dụng voucher nào.'
                          : 'Bạn chưa lấy voucher nào.'}
                      </strong>
                      {voucherFilter === 'used' ? (
                        <button type="button" onClick={() => setVoucherFilter('claimed')}>
                          Xem voucher đã lấy <span aria-hidden="true">›</span>
                        </button>
                      ) : (
                        <Link to="/vouchers">Khám phá voucher</Link>
                      )}
                    </div>
                  ) : (
                  <div className="store-account-voucher-grid">
                    {visibleClaimedVouchers.map((voucher) => {
                      const expired = isVoucherExpired(voucher);
                      const canUse = voucher.status === 'available' && !expired;
                      const statusLabel = voucher.status === 'redeemed'
                        ? 'Đã sử dụng'
                        : expired ? 'Hết hạn' : 'Đã lấy';
                      return (
                        <article
                          className={`store-account-voucher-card ${canUse ? '' : 'is-unavailable'}`}
                          key={voucher.id}
                        >
                          <span className="store-account-voucher-icon">
                            <img src="/logo.png" alt="NP Food" />
                          </span>
                          <div className="store-account-voucher-details">
                            <span className="store-account-customer-voucher-status">{statusLabel}</span>
                            <strong>{formatVoucherDiscount(voucher)}</strong>
                            <p>{voucher.name || 'Ưu đãi NP Food'}</p>
                            {Number(voucher.minOrder) > 0 && (
                              <small>Đơn tối thiểu {Number(voucher.minOrder).toLocaleString('vi-VN')}₫</small>
                            )}
                            {voucher.expiresAt && (
                              <small>Hạn sử dụng: {new Date(voucher.expiresAt).toLocaleDateString('vi-VN')}</small>
                            )}
                            {voucher.status === 'redeemed' && voucher.redeemedAt && (
                              <small>
                                Đã sử dụng: {new Date(voucher.redeemedAt).toLocaleString('vi-VN')}
                              </small>
                            )}
                            {canUse ? (
                              <Link
                                to="/cart"
                                state={{ voucherId: voucher.voucherId || voucher.id }}
                              >
                                Dùng ngay
                              </Link>
                            ) : (
                              <span className="store-account-voucher-status-note">{statusLabel}</span>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                  )
                )}
                {voucherClaimNotice && <p className="store-account-voucher-notice" role="status">{voucherClaimNotice}</p>}
              </section>
            ) : (
              <section aria-labelledby="store-account-profile-title">
                <div className="store-account-content-heading">
                  <div>
                    <h1 id="store-account-profile-title">Thông tin của tôi</h1>
                    <p>Thông tin tài khoản và quyền lợi thành viên</p>
                  </div>
                </div>
              {profileLoading ? (
                <p className="store-account-orders-message">Đang tải hồ sơ...</p>
              ) : profileError ? (
                <p className="store-account-error" role="alert">{profileError}</p>
              ) : (
                <>
                  <div className="store-account-profile-details">
                    <div>
                      <span>Họ và tên</span>
                      <strong>{customerProfile?.name || user.displayName || 'Khách hàng'}</strong>
                    </div>
                    <div>
                      <span>Email</span>
                      <strong>{customerProfile?.email || user.email || 'Chưa cập nhật'}</strong>
                    </div>
                    <div>
                      <span>Số điện thoại</span>
                      <strong>{customerProfile?.phone || user.phoneNumber || 'Chưa cập nhật'}</strong>
                    </div>
                  </div>
                  <div className="store-account-loyalty">
                    <div>
                      <span>Hạng thành viên</span>
                      <strong>{customerProfile?.tier || 'Đồng'}</strong>
                    </div>
                    <div>
                      <span>Điểm tích lũy</span>
                      <strong>{formatPoints(customerProfile?.points)} điểm</strong>
                    </div>
                  </div>
                  {hasPasswordProvider ? (
                    <form className="store-account-password-form" onSubmit={handleChangePassword}>
                      <h3>Đổi mật khẩu</h3>
                      <label>Mật khẩu hiện tại
                        <input
                          type="password"
                          autoComplete="current-password"
                          value={passwordForm.currentPassword}
                          onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })}
                          required
                        />
                      </label>
                      <label>Mật khẩu mới
                        <input
                          type="password"
                          autoComplete="new-password"
                          minLength={6}
                          value={passwordForm.newPassword}
                          onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })}
                          required
                        />
                      </label>
                      <label>Xác nhận mật khẩu mới
                        <input
                          type="password"
                          autoComplete="new-password"
                          minLength={6}
                          value={passwordForm.confirmPassword}
                          onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })}
                          required
                        />
                      </label>
                      {passwordError && <p className="store-account-error" role="alert">{passwordError}</p>}
                      {passwordNotice && <p className="store-account-success" role="status">{passwordNotice}</p>}
                      <button type="submit" className="store-account-primary" disabled={changingPassword}>
                        {changingPassword ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
                      </button>
                    </form>
                  ) : (
                    <p className="store-account-orders-message">
                      Tài khoản đăng nhập bằng Google, Facebook hoặc số điện thoại không dùng mật khẩu riêng để đổi tại đây.
                    </p>
                  )}
                </>
              )}
              </section>
            )}
            {error && <p className="store-account-error" role="alert">{error}</p>}
          </section>
        </div>
      </div>
    );
  }

  const isRegister = mode === 'register';

  return (
    <div className="store-account-page">
      <section className="store-account-card">
        <span className="store-account-eyebrow">{isRegister ? 'THÀNH VIÊN NP FOOD' : 'CHÀO MỪNG BẠN'}</span>
        <h1>{isRegister ? 'Đăng ký tài khoản' : 'Đăng nhập'}</h1>
        <p className="store-account-description">
          {isRegister ? 'Tạo tài khoản để đặt hàng và tích điểm thành viên.' : 'Đăng nhập để tiếp tục đặt hàng.'}
        </p>
        {phoneStep === 'closed' ? (
        <form className="store-account-form" onSubmit={handleSubmit}>
          {isRegister && (
            <>
              <label>Họ và tên
                <input
                  type="text"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  autoComplete="name"
                  required
                />
              </label>
              <label>Số điện thoại
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                  autoComplete="tel"
                  required
                />
              </label>
            </>
          )}
          <label>Email
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              autoComplete="email"
              required
            />
          </label>
          <label>Mật khẩu
            <span className="store-account-password-input">
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                minLength={6}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                aria-pressed={showPassword}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12Z" />
                  <circle cx="12" cy="12" r="3" />
                  {!showPassword && <path d="m4 4 16 16" />}
                </svg>
              </button>
            </span>
          </label>
          {isRegister && (
            <label>Xác nhận mật khẩu
              <span className="store-account-password-input">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={form.confirmPassword}
                  onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })}
                  autoComplete="new-password"
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((visible) => !visible)}
                  aria-label={showConfirmPassword ? 'Ẩn mật khẩu xác nhận' : 'Hiện mật khẩu xác nhận'}
                  aria-pressed={showConfirmPassword}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12Z" />
                    <circle cx="12" cy="12" r="3" />
                    {!showConfirmPassword && <path d="m4 4 16 16" />}
                  </svg>
                </button>
              </span>
            </label>
          )}
          {error && <p className="store-account-error" role="alert">{error}</p>}
          <button type="submit" className="store-account-primary" disabled={submitting}>
            {submitting
              ? 'Đang xử lý...'
              : isRegister ? 'Đăng ký và tiếp tục' : 'Đăng nhập để mua hàng'}
          </button>
          <div className="store-account-divider"><span>Hoặc tiếp tục với</span></div>
          <div className="store-account-social-buttons">
            <button
              type="button"
              className="store-account-social-button"
              onClick={() => handleSocialSignIn('google')}
              disabled={submitting}
            >
              <span className="store-account-google-icon" aria-hidden="true">G</span>
              <span className="store-account-social-label">
                <span className="store-account-social-label-full">
                  {socialProvider === 'google'
                    ? 'Đang kết nối...'
                    : `${isRegister ? 'Đăng ký' : 'Đăng nhập'} với Google`}
                </span>
                <span className="store-account-social-label-mobile">
                  {socialProvider === 'google'
                    ? 'Đang kết nối...'
                    : `${isRegister ? 'Đăng ký' : 'Đăng nhập'} Google`}
                </span>
              </span>
            </button>
            <button
              type="button"
              className="store-account-social-button"
              onClick={() => handleSocialSignIn('facebook')}
              disabled={submitting}
            >
              <span className="store-account-facebook-icon" aria-hidden="true">f</span>
              <span className="store-account-social-label">
                <span className="store-account-social-label-full">
                  {socialProvider === 'facebook'
                    ? 'Đang kết nối...'
                    : `${isRegister ? 'Đăng ký' : 'Đăng nhập'} với Facebook`}
                </span>
                <span className="store-account-social-label-mobile">
                  {socialProvider === 'facebook'
                    ? 'Đang kết nối...'
                    : `${isRegister ? 'Đăng ký' : 'Đăng nhập'} Facebook`}
                </span>
              </span>
            </button>
          </div>
          <div className="store-account-divider"><span>Hoặc dùng số điện thoại</span></div>
          <button
            type="button"
            className="store-account-phone-button"
            onClick={() => {
              setError('');
              setPhoneNotice('');
              setPhoneForm({ name: '', phone: '', code: '' });
              setPhoneStep('phone');
            }}
            disabled={submitting}
          >
            {isRegister ? 'Đăng ký với số điện thoại' : 'Đăng nhập với số điện thoại'}
          </button>
        </form>
        ) : (
          <form
            className="store-account-form"
            onSubmit={phoneStep === 'phone' ? handleSendPhoneCode : handleVerifyPhoneCode}
          >
            <p className="store-account-phone-notice">
              Hoàn tất xác minh bên dưới để gửi mã SMS.
            </p>
            <div id="customer-phone-recaptcha" />
            {phoneStep === 'phone' ? (
              <>
                <label>Họ và tên
                  <input
                    type="text"
                    value={phoneForm.name}
                    onChange={(event) => setPhoneForm({ ...phoneForm, name: event.target.value })}
                    autoComplete="name"
                    required
                  />
                </label>
                <label>Số điện thoại
                  <input
                    type="tel"
                    value={phoneForm.phone}
                    onChange={(event) => setPhoneForm({ ...phoneForm, phone: event.target.value })}
                    autoComplete="tel"
                    placeholder="số điện thoại"
                    required
                  />
                </label>
                <button type="submit" className="store-account-primary" disabled={submitting}>
                  {submitting ? 'Đang gửi mã...' : 'Gửi mã xác minh SMS'}
                </button>
              </>
            ) : (
              <>
                <p className="store-account-phone-notice">{phoneNotice}</p>
                <label>Mã xác minh SMS
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={phoneForm.code}
                    onChange={(event) => setPhoneForm({ ...phoneForm, code: event.target.value.replace(/\D/g, '').slice(0, 6) })}
                    placeholder="Nhập mã 6 số"
                    maxLength={6}
                    required
                  />
                </label>
                <button type="submit" className="store-account-primary" disabled={submitting || phoneForm.code.length !== 6}>
                  {submitting ? 'Đang xác minh...' : 'Xác nhận và tiếp tục'}
                </button>
              </>
            )}
            {error && <p className="store-account-error" role="alert">{error}</p>}
            <button type="button" className="store-account-secondary" onClick={returnToAccountOptions} disabled={submitting}>
              Quay lại
            </button>
          </form>
        )}
        <p className="store-account-switch">
          {isRegister ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}{' '}
          <Link to={isRegister ? '/login' : '/register'} state={location.state}>
            {isRegister ? 'Đăng nhập' : 'Đăng ký ngay'}
          </Link>
        </p>
      </section>
    </div>
  );
};

export default CustomerAccount;
