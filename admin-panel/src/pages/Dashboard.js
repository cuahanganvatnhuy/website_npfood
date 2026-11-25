import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAllProducts } from '../services/productService.js';
import { getAllCategories } from '../services/categoryService.js';
import { getAllNews } from '../services/pageService.js';
import { getAllOrders } from '../services/orderService.js';
import LoadingSpinner from '../components/LoadingSpinner.js';
import '../css/Dashboard.css';

const orderStatuses = [
  { value: 'pending', label: 'Chờ xác nhận', icon: '◷' },
  { value: 'processing', label: 'Đang xử lý', icon: '⟳' },
  { value: 'shipped', label: 'Đang giao', icon: '⇢' },
  { value: 'delivered', label: 'Đã giao', icon: '✓' },
  { value: 'cancelled', label: 'Đã hủy', icon: '×' }
];

const getOrderStatus = (order) => {
  const status = String(order.status || 'pending').toLowerCase();
  return orderStatuses.some((item) => item.value === status) ? status : 'pending';
};

const getCustomerName = (order) => (
  order.customer?.name || order.customerName || order.name || 'Khách hàng'
);

const getOrderTotal = (order) => {
  const total = Number(order.totalAmount ?? order.total ?? order.amount ?? 0);
  return Number.isFinite(total) ? total : 0;
};

const formatCurrency = (amount) => `${Math.round(amount).toLocaleString('vi-VN')} ₫`;

const formatOrderDate = (order) => {
  const date = new Date(order.createdAt || order.orderDate || '');
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
};

const Dashboard = () => {
  const [dashboardData, setDashboardData] = useState({
    products: [],
    categories: [],
    news: [],
    orders: []
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    setLoadError('');
    let timeoutId;
    try {
      const [products, categories, news, orders] = await Promise.race([
        Promise.all([
          getAllProducts(),
          getAllCategories(),
          getAllNews(),
          getAllOrders()
        ]),
        new Promise((_, reject) => {
          timeoutId = window.setTimeout(() => reject(new Error('Hết thời gian chờ dữ liệu.')), 15000);
        })
      ]);

      setDashboardData({ products, categories, news, orders });
    } catch (error) {
      console.error('Lỗi khi tải tổng quan dashboard:', error);
      setLoadError(error.message || 'Không thể tải dữ liệu tổng quan.');
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const { products, categories, news, orders } = dashboardData;
  const lowStockProducts = products
    .filter((product) => {
      if (product.isActive === false || product.stock === '' || product.stock === null || product.stock === undefined) {
        return false;
      }
      const stock = Number(product.stock);
      return Number.isFinite(stock) && stock <= 5;
    })
    .sort((a, b) => Number(a.stock) - Number(b.stock));
  const statusCounts = orderStatuses.map((status) => ({
    ...status,
    count: orders.filter((order) => getOrderStatus(order) === status.value).length
  }));
  const deliveredRevenue = orders
    .filter((order) => getOrderStatus(order) === 'delivered')
    .reduce((sum, order) => {
      const total = getOrderTotal(order);
      return Number.isFinite(total) ? sum + total : sum;
    }, 0);
  const recentOrders = orders.slice(0, 5);
  const quickActions = [
    { title: 'Thêm sản phẩm', description: 'Cập nhật mặt hàng mới', path: '/products', icon: '＋', tone: 'green' },
    { title: 'Xử lý đơn hàng', description: 'Theo dõi đơn cần xác nhận', path: '/orders', icon: '▤', tone: 'gold' },
    { title: 'Tạo khuyến mãi', description: 'Quản lý voucher cửa hàng', path: '/vouchers', icon: '％', tone: 'orange' },
    { title: 'Viết bài mới', description: 'Cập nhật tin tức cửa hàng', path: '/news', icon: '✎', tone: 'blue' }
  ];

  return (
    <div className="dashboard-container">
      <div className="dashboard-page">
        <div className="dashboard-welcome">
          <div>
            <span className="dashboard-eyebrow">TỔNG QUAN CỬA HÀNG</span>
            <h2>Chào mừng trở lại!</h2>
            <p>Theo dõi nhanh tình hình kinh doanh và các công việc cần xử lý.</p>
          </div>
          <div className="dashboard-today">
            <span aria-hidden="true">▦</span>
            <div>
              <small>Hôm nay</small>
              <strong>{new Date().toLocaleDateString('vi-VN', {
                weekday: 'long',
                day: '2-digit',
                month: 'long',
                year: 'numeric'
              })}</strong>
            </div>
            <button type="button" onClick={fetchDashboardData} disabled={loading} aria-label="Làm mới dashboard">
              ↻
            </button>
          </div>
        </div>

        {loading ? (
          <div className="dashboard-loading">
            <LoadingSpinner message="Đang tải tổng quan cửa hàng..." inline />
          </div>
        ) : loadError ? (
          <div className="dashboard-load-error" role="alert">
            <strong>Không tải được dữ liệu dashboard</strong>
            <p>{loadError}</p>
            <button type="button" onClick={fetchDashboardData}>Thử tải lại</button>
          </div>
        ) : (
          <>
            <div className="stats-grid">
              <article className="stat-card">
                <div className="stat-icon blue">📦</div>
                <div className="stat-copy">
                  <p className="stat-label">Tổng sản phẩm</p>
                  <p className="stat-value">{products.length}</p>
                  <small>{lowStockProducts.length} sản phẩm sắp hết hàng</small>
                </div>
              </article>
              <article className="stat-card">
                <div className="stat-icon green">📁</div>
                <div className="stat-copy">
                  <p className="stat-label">Danh mục</p>
                  <p className="stat-value">{categories.length}</p>
                  <small>Đang quản lý trong cửa hàng</small>
                </div>
              </article>
              <article className="stat-card">
                <div className="stat-icon purple">📰</div>
                <div className="stat-copy">
                  <p className="stat-label">Bài viết</p>
                  <p className="stat-value">{news.length}</p>
                  <small>Nội dung và tin tức</small>
                </div>
              </article>
              <article className="stat-card">
                <div className="stat-icon orange">🧾</div>
                <div className="stat-copy">
                  <p className="stat-label">Tổng đơn hàng</p>
                  <p className="stat-value">{orders.length}</p>
                  <small>{statusCounts.find((item) => item.value === 'pending')?.count || 0} đơn chờ xác nhận</small>
                </div>
              </article>
              <article className="stat-card revenue">
                <div className="stat-icon gold">₫</div>
                <div className="stat-copy">
                  <p className="stat-label">Doanh thu đơn đã giao</p>
                  <p className="stat-value">{formatCurrency(deliveredRevenue)}</p>
                  <small>Chỉ tính các đơn đã giao thành công</small>
                </div>
              </article>
            </div>

            <section className="dashboard-section order-overview">
              <div className="dashboard-section-heading">
                <div>
                  <span className="dashboard-section-kicker">ĐƠN HÀNG</span>
                  <h3>Tình hình xử lý</h3>
                </div>
                <Link to="/orders">Xem tất cả <span aria-hidden="true">→</span></Link>
              </div>
              <div className="order-status-grid">
                {statusCounts.map((status) => (
                  <Link
                    to="/orders"
                    key={status.value}
                    className={`order-status-card ${status.value}`}
                  >
                    <span className="order-status-icon" aria-hidden="true">{status.icon}</span>
                    <span className="order-status-copy">
                      <small>{status.label}</small>
                      <strong>{status.count}</strong>
                    </span>
                    <span className="order-status-arrow" aria-hidden="true">↗</span>
                  </Link>
                ))}
              </div>
            </section>

            <div className="dashboard-main-grid">
              <section className="dashboard-section recent-orders">
                <div className="dashboard-section-heading">
                  <div>
                    <span className="dashboard-section-kicker">MỚI CẬP NHẬT</span>
                    <h3>Đơn hàng gần đây</h3>
                  </div>
                  <Link to="/orders">Quản lý đơn <span aria-hidden="true">→</span></Link>
                </div>
                {recentOrders.length === 0 ? (
                  <div className="dashboard-empty">
                    <span aria-hidden="true">🧾</span>
                    <p>Chưa có đơn hàng nào.</p>
                  </div>
                ) : (
                  <div className="recent-orders-list">
                    {recentOrders.map((order) => {
                      const status = getOrderStatus(order);
                      const orderNumber = order.orderNumber || order.id?.slice(-8).toUpperCase() || '—';
                      return (
                        <Link to="/orders" className="recent-order-row" key={order.id}>
                          <span className={`recent-order-icon ${status}`} aria-hidden="true">
                            {statusCounts.find((item) => item.value === status)?.icon}
                          </span>
                          <span className="recent-order-details">
                            <strong>#{orderNumber}</strong>
                            <small>{getCustomerName(order)} · {formatOrderDate(order)}</small>
                          </span>
                          <span className="recent-order-total">{formatCurrency(getOrderTotal(order))}</span>
                          <span className={`recent-order-status ${status}`}>
                            {statusCounts.find((item) => item.value === status)?.label}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="dashboard-section inventory-alerts">
                <div className="dashboard-section-heading">
                  <div>
                    <span className="dashboard-section-kicker">KHO HÀNG</span>
                    <h3>Sắp hết hàng</h3>
                  </div>
                  <Link to="/products">Sản phẩm <span aria-hidden="true">→</span></Link>
                </div>
                {lowStockProducts.length === 0 ? (
                  <div className="dashboard-empty inventory-empty">
                    <span aria-hidden="true">✓</span>
                    <p>Tồn kho hiện ổn định.</p>
                  </div>
                ) : (
                  <div className="inventory-list">
                    {lowStockProducts.slice(0, 5).map((product) => (
                      <Link to="/products" className="inventory-row" key={product.id}>
                        <span className="inventory-product-icon" aria-hidden="true">📦</span>
                        <span className="inventory-product-name">{product.name || 'Sản phẩm'}</span>
                        <span className={`inventory-stock ${Number(product.stock) <= 0 ? 'out' : ''}`}>
                          {Number(product.stock) <= 0 ? 'Hết hàng' : `Còn ${product.stock}`}
                        </span>
                      </Link>
                    ))}
                    {lowStockProducts.length > 5 && (
                      <p className="inventory-more">Và {lowStockProducts.length - 5} sản phẩm khác cần kiểm tra</p>
                    )}
                  </div>
                )}
              </section>
            </div>

            <section className="dashboard-section quick-actions-section">
              <div className="dashboard-section-heading">
                <div>
                  <span className="dashboard-section-kicker">LỐI TẮT</span>
                  <h3>Thao tác nhanh</h3>
                </div>
              </div>
              <div className="quick-actions-grid">
                {quickActions.map((action) => (
                  <Link to={action.path} className="quick-action-card" key={action.path}>
                    <span className={`quick-action-icon ${action.tone}`} aria-hidden="true">{action.icon}</span>
                    <span>
                      <strong>{action.title}</strong>
                      <small>{action.description}</small>
                    </span>
                    <span className="quick-action-arrow" aria-hidden="true">→</span>
                  </Link>
                ))}
              </div>
            </section>

            <section className="system-info-section">
              <div className="system-info-title">
                <span aria-hidden="true">⚙</span>
                <h3>Thông tin hệ thống</h3>
              </div>
              <div className="info-grid">
                <div className="info-item"><span className="info-label">Phiên bản</span><span className="info-value">1.0.0</span></div>
                <div className="info-item"><span className="info-label">Trạng thái</span><span className="info-value status-active">Hoạt động</span></div>
                <div className="info-item"><span className="info-label">Database</span><span className="info-value">Firebase Realtime Database</span></div>
                <div className="info-item"><span className="info-label">Authentication</span><span className="info-value">Firebase Auth</span></div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
