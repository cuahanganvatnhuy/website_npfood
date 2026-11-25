import { useEffect, useMemo, useState } from 'react';
import { getAllOrders, markOrderAsPaid, updateOrderStatus } from '../services/orderService.js';
import LoadingSpinner from '../components/LoadingSpinner.js';
import '../css/Orders.css';

const orderStatuses = [
  { value: 'pending', label: 'Chờ xác nhận' },
  { value: 'processing', label: 'Đang xử lý' },
  { value: 'shipped', label: 'Đang giao' },
  { value: 'delivered', label: 'Đã giao' },
  { value: 'cancelled', label: 'Đã hủy' }
];
const ordersPerPage = 10;

const getStatus = (order) => {
  const status = String(order.status || 'pending').toLowerCase();
  return orderStatuses.some((item) => item.value === status) ? status : 'pending';
};

const getOrderItems = (order) => {
  if (Array.isArray(order.items)) return order.items;
  if (order.items && typeof order.items === 'object') return Object.values(order.items);
  return [];
};

const getItemName = (item) => {
  if (typeof item === 'string') return item;
  if (!item || typeof item !== 'object') return 'Sản phẩm';
  return item.name || item.productName || 'Sản phẩm';
};

const getItemQuantity = (item) => (
  item && typeof item === 'object' ? item.quantity || item.qty || 1 : 1
);

const getCustomer = (order) => {
  const customer = order.customer && typeof order.customer === 'object' ? order.customer : {};
  return {
    name: customer.name || order.customerName || order.name || 'Khách hàng',
    phone: customer.phone || order.phone || '',
    email: customer.email || order.email || '',
    address: customer.address || order.address || ''
  };
};

const getOrderDate = (order) => {
  const value = order.createdAt || order.orderDate;
  if (!value) return { date: '—', time: '' };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: '—', time: '' };
  return {
    date: date.toLocaleDateString('vi-VN'),
    time: date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  };
};

const formatOrderTotal = (order) => (
  Number(order.totalAmount ?? order.total ?? order.amount ?? 0).toLocaleString('vi-VN')
);

const isOrderPaid = (order) => order.paid === true ||
  String(order.paymentStatus || '').toLowerCase() === 'paid';

const getPaymentMethodLabel = (order) => {
  if (order.paymentMethod === 'momo') return 'MoMo qua QR';
  if (order.paymentMethod === 'cash_on_delivery' || !order.paymentMethod) return 'Khi nhận hàng';
  return order.paymentMethod;
};

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [updatingPaymentOrderId, setUpdatingPaymentOrderId] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    if (!selectedOrder) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setSelectedOrder(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedOrder]);

  const fetchOrders = async () => {
    setError('');
    try {
      setOrders(await getAllOrders());
    } catch (fetchError) {
      console.error('Lỗi khi tải đơn hàng:', fetchError);
      setError('Không thể tải đơn hàng. Vui lòng kiểm tra kết nối rồi thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const statusCounts = useMemo(() => {
    const counts = { all: orders.length };
    orderStatuses.forEach(({ value }) => {
      counts[value] = orders.filter((order) => getStatus(order) === value).length;
    });
    return counts;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase();
    return orders.filter((order) => {
      if (statusFilter !== 'all' && getStatus(order) !== statusFilter) return false;
      if (!query) return true;

      const customer = getCustomer(order);
      const orderItems = getOrderItems(order);
      const searchableValues = [
        order.orderNumber,
        order.id,
        customer.name,
        customer.phone,
        customer.email,
        ...orderItems.map(getItemName)
      ];
      return searchableValues.some((value) => String(value || '').toLocaleLowerCase().includes(query));
    });
  }, [orders, searchTerm, statusFilter]);
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / ordersPerPage));
  const displayedPage = Math.min(currentPage, totalPages);
  const firstVisibleOrder = (displayedPage - 1) * ordersPerPage;
  const paginatedOrders = filteredOrders.slice(
    firstVisibleOrder,
    firstVisibleOrder + ordersPerPage
  );
  const pageWindowStart = Math.max(1, Math.min(displayedPage - 2, totalPages - 4));
  const pageNumbers = Array.from(
    { length: Math.min(totalPages, 5) },
    (_, index) => pageWindowStart + index
  );

  const handleStatusChange = async (orderId, status) => {
    setUpdatingOrderId(orderId);
    try {
      const result = await updateOrderStatus(orderId, status);
      await fetchOrders();
      const loyaltyMessages = {
        missing_email: 'Đơn đã giao nhưng chưa cộng điểm vì đơn hàng không có email khách.',
        customer_not_found: 'Đơn cũ chưa cộng điểm vì email đăng ký không khớp hồ sơ khách hàng.',
        customer_uid_not_found: (loyalty) => `Đơn đã giao nhưng UID ${loyalty.orderUid} không tìm thấy hồ sơ khách hàng trong cơ sở dữ liệu.`,
        loyalty_transaction_not_committed: (loyalty) => `UID ${loyalty.orderUid} đã khớp hồ sơ khách hàng nhưng Firebase không ghi được giao dịch cộng điểm.`,
        ambiguous_customer: 'Đơn đã giao nhưng chưa cộng điểm vì UID hoặc email khớp nhiều hồ sơ khách.',
        invalid_amount: 'Đơn đã giao nhưng chưa cộng điểm vì tổng tiền đơn hàng không hợp lệ.'
      };
      const loyalty = result?.loyalty;
      const loyaltyMessage = loyalty && loyaltyMessages[loyalty.status];
      if (typeof loyaltyMessage === 'function') {
        alert(loyaltyMessage(loyalty));
      } else if (loyaltyMessage) {
        alert(loyaltyMessage);
      }
    } catch (updateError) {
      console.error('Lỗi khi cập nhật đơn hàng:', updateError);
      alert('Cập nhật đơn hàng thất bại: ' + updateError.message);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleMarkOrderAsPaid = async (orderId, orderLabel) => {
    if (!window.confirm(`Bạn đã kiểm tra và nhận đủ tiền MoMo cho đơn ${orderLabel}?`)) return;
    setUpdatingPaymentOrderId(orderId);
    try {
      const paymentUpdate = await markOrderAsPaid(orderId);
      await fetchOrders();
      setSelectedOrder((current) => (
        current?.id === orderId ? { ...current, ...paymentUpdate } : current
      ));
    } catch (updateError) {
      console.error('Lỗi khi xác nhận thanh toán:', updateError);
      alert('Xác nhận thanh toán thất bại: ' + updateError.message);
    } finally {
      setUpdatingPaymentOrderId(null);
    }
  };

  return (
    <div className="orders-container">
      <div className="orders-page">
        <div className="orders-page-heading">
          <div>
            <span className="orders-eyebrow">QUẢN LÝ CỬA HÀNG</span>
            <h2>Đơn hàng</h2>
            <p>Theo dõi đơn hàng, trạng thái thanh toán và tiến độ giao hàng.</p>
          </div>
          <button type="button" className="orders-refresh-button" onClick={fetchOrders} disabled={loading}>
            <span aria-hidden="true">↻</span>
            Làm mới
          </button>
        </div>

        <div className="order-stats-grid">
          <button
            type="button"
            className={`order-stat-card ${statusFilter === 'all' ? 'selected' : ''}`}
            onClick={() => {
              setStatusFilter('all');
              setCurrentPage(1);
            }}
          >
            <span className="order-stat-icon all">▤</span>
            <span><small>Tất cả đơn</small><strong>{statusCounts.all || 0}</strong></span>
          </button>
          {orderStatuses.map((status) => (
            <button
              type="button"
              key={status.value}
              className={`order-stat-card ${statusFilter === status.value ? 'selected' : ''}`}
              onClick={() => {
                setStatusFilter(status.value);
                setCurrentPage(1);
              }}
            >
              <span className={`order-stat-icon ${status.value}`}>
                {status.value === 'pending' ? '◷' : status.value === 'processing' ? '⟳' : status.value === 'shipped' ? '⇢' : status.value === 'delivered' ? '✓' : '×'}
              </span>
              <span><small>{status.label}</small><strong>{statusCounts[status.value] || 0}</strong></span>
            </button>
          ))}
        </div>

        <section className="orders-card">
          <div className="orders-card-header">
            <div>
              <h3>Danh sách đơn hàng</h3>
              <p>{filteredOrders.length} đơn hàng</p>
            </div>
            <div className="orders-toolbar">
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Tìm mã đơn, khách hàng..."
                className="orders-search"
                aria-label="Tìm đơn hàng"
              />
              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setCurrentPage(1);
                }}
                className="orders-filter"
                aria-label="Lọc theo trạng thái"
              >
                <option value="all">Tất cả trạng thái</option>
                {orderStatuses.map((status) => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="orders-message">
              <LoadingSpinner message="Đang tải đơn hàng..." inline />
            </div>
          ) : error ? (
            <div className="orders-message orders-error">
              <strong>{error}</strong>
              <button type="button" onClick={fetchOrders} className="orders-retry-button">Thử lại</button>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="orders-message orders-empty">
              <span aria-hidden="true">🧾</span>
              <strong>{orders.length === 0 ? 'Chưa có đơn hàng' : 'Không tìm thấy đơn hàng'}</strong>
              <p>{orders.length === 0 ? 'Các đơn hàng mới sẽ xuất hiện tại đây.' : 'Thử đổi từ khóa hoặc bộ lọc trạng thái.'}</p>
            </div>
          ) : (
            <>
              <div className="orders-table-scroll">
                <table className="orders-table">
                  <thead>
                    <tr>
                      <th>Mã đơn hàng</th>
                      <th>Khách hàng</th>
                      <th>Sản phẩm</th>
                      <th>Tổng tiền</th>
                      <th>Thanh toán</th>
                      <th>Ngày đặt</th>
                      <th>Trạng thái</th>
                      <th>Cập nhật</th>
                      <th>Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedOrders.map((order) => {
                    const items = getOrderItems(order);
                    const customer = getCustomer(order);
                    const status = getStatus(order);
                    const orderDate = getOrderDate(order);
                    const orderLabel = order.orderNumber || order.id;
                    return (
                      <tr key={order.id}>
                        <td>
                          <span className="order-id">{orderLabel}</span>
                        </td>
                        <td>
                          <div className="order-customer-name">{customer.name}</div>
                          <div className="order-customer-contact">{customer.phone || customer.email || 'Chưa có liên hệ'}</div>
                        </td>
                        <td>
                          {items.length > 0 ? (
                            <div className="order-items">
                              {items.slice(0, 2).map((item, index) => {
                                const name = getItemName(item);
                                const quantity = getItemQuantity(item);
                                return <span key={`${index}-${name}`}>{name} <b>× {quantity}</b></span>;
                              })}
                              {items.length > 2 && <small>+{items.length - 2} sản phẩm khác</small>}
                            </div>
                          ) : <span className="order-muted">Chưa có thông tin sản phẩm</span>}
                        </td>
                        <td className="order-total">{formatOrderTotal(order)} ₫</td>
                        <td className="order-payment-cell">
                          <span>{getPaymentMethodLabel(order)}</span>
                          {order.paymentMethod === 'momo' ? (
                            isOrderPaid(order) ? (
                              <span className="order-payment-badge paid">Đã thanh toán</span>
                            ) : (
                              <>
                                <span className="order-payment-badge pending">Chưa thanh toán</span>
                                <button
                                  type="button"
                                  className="order-payment-confirm-button"
                                  disabled={updatingPaymentOrderId === order.id}
                                  onClick={() => handleMarkOrderAsPaid(order.id, orderLabel)}
                                >
                                  {updatingPaymentOrderId === order.id ? 'Đang lưu…' : 'Đánh dấu đã thanh toán'}
                                </button>
                              </>
                            )
                          ) : (
                            <span className="order-payment-badge cash">Thu khi nhận</span>
                          )}
                        </td>
                        <td>
                          <div className="order-date">{orderDate.date}</div>
                          <div className="order-time">{orderDate.time}</div>
                        </td>
                        <td>
                          <span className={`order-status-badge ${status}`}>
                            <span />
                            {orderStatuses.find((item) => item.value === status)?.label}
                          </span>
                        </td>
                        <td>
                          <select
                            className="order-status-select"
                            value={status}
                            disabled={updatingOrderId === order.id}
                            onChange={(event) => handleStatusChange(order.id, event.target.value)}
                            aria-label={`Cập nhật trạng thái đơn ${orderLabel}`}
                          >
                            {orderStatuses.map((item) => (
                              <option key={item.value} value={item.value}>{item.label}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="order-view-button"
                            onClick={() => setSelectedOrder(order)}
                            aria-label={`Xem chi tiết đơn ${orderLabel}`}
                            title="Xem chi tiết đơn hàng"
                          >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                    })}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="orders-pagination">
                  <span className="orders-pagination-summary">
                    Hiển thị {firstVisibleOrder + 1}–{firstVisibleOrder + paginatedOrders.length} / {filteredOrders.length} đơn
                  </span>
                  <nav className="orders-pagination-controls" aria-label="Phân trang đơn hàng">
                    <button
                      type="button"
                      onClick={() => setCurrentPage(displayedPage - 1)}
                      disabled={displayedPage === 1}
                    >
                      Trước
                    </button>
                    {pageWindowStart > 1 && (
                      <>
                        <button type="button" onClick={() => setCurrentPage(1)}>1</button>
                        {pageWindowStart > 2 && <span className="orders-pagination-ellipsis">…</span>}
                      </>
                    )}
                    {pageNumbers.map((pageNumber) => (
                      <button
                        type="button"
                        key={pageNumber}
                        className={displayedPage === pageNumber ? 'active' : ''}
                        aria-current={displayedPage === pageNumber ? 'page' : undefined}
                        onClick={() => setCurrentPage(pageNumber)}
                      >
                        {pageNumber}
                      </button>
                    ))}
                    {pageWindowStart + pageNumbers.length - 1 < totalPages && (
                      <>
                        {pageWindowStart + pageNumbers.length < totalPages && (
                          <span className="orders-pagination-ellipsis">…</span>
                        )}
                        <button type="button" onClick={() => setCurrentPage(totalPages)}>
                          {totalPages}
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => setCurrentPage(displayedPage + 1)}
                      disabled={displayedPage === totalPages}
                    >
                      Sau
                    </button>
                  </nav>
                </div>
              )}
            </>
          )}
        </section>
      </div>
      {selectedOrder && (() => {
        const customer = getCustomer(selectedOrder);
        const orderDate = getOrderDate(selectedOrder);
        const status = getStatus(selectedOrder);
        const items = getOrderItems(selectedOrder);
        const orderLabel = selectedOrder.orderNumber || selectedOrder.id;
        const paymentMethod = selectedOrder.paymentMethod === 'momo'
          ? 'Thanh toán MoMo qua QR'
          : selectedOrder.paymentMethod === 'cash_on_delivery'
            ? 'Thanh toán khi nhận hàng'
            : selectedOrder.paymentMethod || 'Chưa có thông tin';
        const paymentIsPaid = isOrderPaid(selectedOrder);
        const deliveryMethod = selectedOrder.deliveryMethod === 'pickup'
          ? 'Nhận tại cửa hàng'
          : 'Giao tận nơi';
        const deliveryLocation = selectedOrder.deliveryLocation;
        const hasDeliveryLocation = typeof deliveryLocation?.latitude === 'number' &&
          Number.isFinite(deliveryLocation.latitude) &&
          typeof deliveryLocation?.longitude === 'number' &&
          Number.isFinite(deliveryLocation.longitude);
        const deliveryMapUrl = hasDeliveryLocation
          ? `https://www.openstreetmap.org/?mlat=${deliveryLocation.latitude}&mlon=${deliveryLocation.longitude}#map=16/${deliveryLocation.latitude}/${deliveryLocation.longitude}`
          : '';

        return (
          <div
            className="order-detail-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setSelectedOrder(null);
            }}
          >
            <section
              className="order-detail-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="order-detail-title"
            >
              <button
                type="button"
                className="order-detail-close"
                onClick={() => setSelectedOrder(null)}
                aria-label="Đóng chi tiết đơn hàng"
              >
                ×
              </button>
              <header className="order-detail-header">
                <div>
                  <span className="orders-eyebrow">CHI TIẾT ĐƠN HÀNG</span>
                  <h3 id="order-detail-title">{orderLabel}</h3>
                  <p>{orderDate.date}{orderDate.time ? ` · ${orderDate.time}` : ''}</p>
                </div>
                <span className={`order-status-badge ${status}`}>
                  <span />
                  {orderStatuses.find((item) => item.value === status)?.label}
                </span>
              </header>

              <div className="order-detail-summary">
                <div><small>Khách hàng</small><strong>{customer.name}</strong></div>
                <div><small>Số điện thoại</small><strong>{customer.phone || 'Chưa cung cấp'}</strong></div>
                <div><small>Email</small><strong>{customer.email || 'Chưa cung cấp'}</strong></div>
                <div><small>Hình thức nhận hàng</small><strong>{deliveryMethod}</strong></div>
                <div><small>Địa chỉ nhận hàng</small><strong>{customer.address || 'Chưa cung cấp'}</strong></div>
                {deliveryMapUrl && (
                  <div>
                    <small>Vị trí GPS</small>
                    <a href={deliveryMapUrl} target="_blank" rel="noreferrer">Mở trên OpenStreetMap</a>
                  </div>
                )}
              </div>

              <div className="order-detail-products">
                <h4>Sản phẩm đặt mua</h4>
                {items.length > 0 ? items.map((item, index) => {
                  const quantity = getItemQuantity(item);
                  const unitPrice = Number(item && typeof item === 'object' ? item.price || item.unitPrice || 0 : 0);
                  return (
                    <div className="order-detail-product" key={`${index}-${getItemName(item)}`}>
                      <div><strong>{getItemName(item)}</strong><small>{quantity} × {unitPrice.toLocaleString('vi-VN')} ₫</small></div>
                      <strong>{(unitPrice * quantity).toLocaleString('vi-VN')} ₫</strong>
                    </div>
                  );
                }) : <p className="order-detail-muted">Đơn hàng chưa có thông tin sản phẩm.</p>}
              </div>

              <div className="order-detail-footer">
                <div className="order-detail-payment">
                  <small>Phương thức thanh toán</small>
                  <strong>{paymentMethod}</strong>
                  {selectedOrder.paymentMethod === 'momo' && (
                    <>
                      <p className={`order-payment-status ${paymentIsPaid ? 'paid' : 'pending'}`}>
                        {paymentIsPaid
                          ? 'Đã xác nhận nhận tiền'
                          : 'Chưa thanh toán'}
                      </p>
                      {!paymentIsPaid && (
                        <button
                          type="button"
                          className="order-payment-confirm-button"
                          disabled={updatingPaymentOrderId === selectedOrder.id}
                          onClick={() => handleMarkOrderAsPaid(selectedOrder.id, orderLabel)}
                        >
                          {updatingPaymentOrderId === selectedOrder.id ? 'Đang lưu…' : 'Đánh dấu đã thanh toán'}
                        </button>
                      )}
                    </>
                  )}
                  {selectedOrder.note && <p>Ghi chú: {selectedOrder.note}</p>}
                </div>
                <div className="order-detail-total">
                  <small>Tổng thanh toán</small>
                  <strong>{formatOrderTotal(selectedOrder)} ₫</strong>
                </div>
              </div>
            </section>
          </div>
        );
      })()}
    </div>
  );
};

export default Orders;
