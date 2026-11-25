import { useEffect, useMemo, useState } from 'react';
import { getAllOrders } from '../services/orderService.js';
import { getAllCustomers, updateCustomer } from '../services/customerService.js';
import { getLoyaltySettings } from '../services/promotionService.js';
import LoadingSpinner from '../components/LoadingSpinner.js';
import '../css/CustomerAccounts.css';

const formatPoints = (points) => `${Number(points) || 0} điểm`;
const formatMoney = (amount) => `${(Number(amount) || 0).toLocaleString('vi-VN')} ₫`;
const normalizeEmail = (email) => String(email || '').trim().toLocaleLowerCase();
const isDeliveredOrder = (order) => String(order.status || '').trim().toLocaleLowerCase() === 'delivered';
const getOrderAmount = (order) => {
  const amount = Number(order.totalAmount ?? order.total ?? order.amount);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
};
const getRedeemedPoints = (order) => Math.max(
  0,
  Math.floor(Number(order.pointsRedeemed) || Number(order.pointsDiscountAmount) || 0)
);

const orderStatusLabels = {
  pending: 'Chờ xác nhận',
  processing: 'Đang xử lý',
  shipped: 'Đang giao',
  delivered: 'Đã giao',
  cancelled: 'Đã hủy'
};

const getOrdersForCustomer = (orders, customer, customers) => orders.filter((order) => {
  const orderUid = String(order.customerUid || order.customer?.uid || '').trim();
  if (orderUid) {
    const uidMatch = customers.find((item) => [item.id, item.uid].filter(Boolean).includes(orderUid));
    if (uidMatch) return uidMatch.id === customer.id;
  }

  const email = normalizeEmail(order.customer?.email || order.email);
  if (!email || email !== normalizeEmail(customer.email)) return false;
  const emailMatches = customers.filter((item) => normalizeEmail(item.email) === email);
  return emailMatches.length === 1 && emailMatches[0].id === customer.id;
});

const getDeliveredSpend = (orders) => orders
  .filter(isDeliveredOrder)
  .reduce((total, order) => total + getOrderAmount(order), 0);

const CustomerAccounts = () => {
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [customerData, orderData, loyaltySettings] = await Promise.all([
        getAllCustomers(),
        getAllOrders(),
        getLoyaltySettings()
      ]);
      const amountPerPoint = Math.max(1, Math.floor(Number(loyaltySettings.amountPerPoint) || 1000));
      const pointsPerAmount = Math.max(1, Math.floor(Number(loyaltySettings.pointsPerAmount) || 1));
      const calculatedCustomers = customerData.map((customer) => {
        const customerOrders = getOrdersForCustomer(orderData, customer, customerData);
        const lifetimeSpend = getDeliveredSpend(customerOrders);
        const redeemedPoints = customerOrders.reduce((total, order) => total + getRedeemedPoints(order), 0);
        const points = Math.max(
          0,
          Math.floor(lifetimeSpend / amountPerPoint) * pointsPerAmount - redeemedPoints
        );
        const tier = (loyaltySettings.tiers || [])
          .filter((item) => points >= Number(item.minPoints || 0))
          .slice(-1)[0]?.name || 'Đồng';
        return {
          ...customer,
          points,
          lifetimeSpend,
          loyaltySpendRemainder: lifetimeSpend % amountPerPoint,
          tier
        };
      });
      const currentCustomersById = new Map(customerData.map((customer) => [customer.id, customer]));
      const customersToUpdate = calculatedCustomers.filter((customer) => (
        Number(customer.points) !== Number(currentCustomersById.get(customer.id)?.points || 0) ||
        Number(customer.lifetimeSpend) !== Number(currentCustomersById.get(customer.id)?.lifetimeSpend || 0) ||
        Number(customer.loyaltySpendRemainder) !== Number(currentCustomersById.get(customer.id)?.loyaltySpendRemainder || 0) ||
        customer.tier !== (currentCustomersById.get(customer.id)?.tier || 'Đồng')
      ));

      await Promise.all(customersToUpdate.map((customer) => updateCustomer(customer.id, {
        points: customer.points,
        lifetimeSpend: customer.lifetimeSpend,
        loyaltySpendRemainder: customer.loyaltySpendRemainder,
        tier: customer.tier
      })));

      setCustomers(calculatedCustomers);
      setOrders(orderData);
    } catch (fetchError) {
      console.error('Lỗi khi tải hoặc đồng bộ điểm khách hàng:', fetchError);
      setError('Không thể tải hoặc cập nhật điểm tài khoản khách hàng. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return customers;
    return customers.filter((customer) => [
      customer.name,
      customer.email,
      customer.phone,
      customer.tier
    ].some((value) => String(value || '').toLocaleLowerCase().includes(query)));
  }, [customers, search]);

  const activeCount = customers.filter((customer) => customer.isActive !== false).length;
  const pointsTotal = customers.reduce((sum, customer) => sum + (Number(customer.points) || 0), 0);
  const selectedCustomerOrders = selectedCustomer
    ? getOrdersForCustomer(orders, selectedCustomer, customers)
    : [];
  const selectedCustomerSpend = getDeliveredSpend(selectedCustomerOrders);

  const handleToggleActive = async (customer) => {
    const isActive = customer.isActive === false;
    try {
      await updateCustomer(customer.id, { isActive });
      setCustomers((current) => current.map((item) => item.id === customer.id ? { ...item, isActive } : item));
    } catch (updateError) {
      console.error('Lỗi khi cập nhật trạng thái tài khoản:', updateError);
      alert(`Cập nhật trạng thái thất bại: ${updateError.message}`);
    }
  };

  return (
    <div className="customer-accounts-page">
      <header className="customer-page-heading">
        <div>
          <span className="customer-eyebrow">CHĂM SÓC KHÁCH HÀNG</span>
          <h2>Quản lý tài khoản khách</h2>
          <p>Theo dõi hồ sơ, lịch sử mua hàng, điểm thưởng và hạng thành viên.</p>
        </div>
        <button type="button" className="customer-refresh-button" onClick={fetchData} disabled={loading}>
          <span aria-hidden="true">↻</span> Làm mới
        </button>
      </header>

      <div className="customer-stats-grid">
        <article><span>👥</span><div><small>Tổng tài khoản</small><strong>{customers.length}</strong></div></article>
        <article><span>✓</span><div><small>Đang hoạt động</small><strong>{activeCount}</strong></div></article>
        <article><span>★</span><div><small>Tổng điểm đã tích</small><strong>{pointsTotal.toLocaleString('vi-VN')}</strong></div></article>
      </div>

      <section className="customer-table-card">
        <div className="customer-table-header">
          <div>
            <h3>Danh sách khách hàng</h3>
            <p>{filteredCustomers.length} tài khoản</p>
          </div>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm tên, email, số điện thoại..."
            aria-label="Tìm khách hàng"
          />
        </div>

        {loading ? (
          <div className="customer-state"><LoadingSpinner message="Đang tải tài khoản..." inline /></div>
        ) : error ? (
          <div className="customer-state customer-error"><strong>{error}</strong><button type="button" onClick={fetchData}>Thử lại</button></div>
        ) : customers.length === 0 ? (
          <div className="customer-state">
            <span aria-hidden="true">👤</span>
            <strong>Chưa có tài khoản khách hàng</strong>
            <p>Danh sách sẽ có dữ liệu khi khách đăng ký tài khoản trên website.</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="customer-state"><strong>Không tìm thấy khách hàng</strong><p>Thử tìm bằng tên, email hoặc số điện thoại khác.</p></div>
        ) : (
          <div className="customer-table-scroll">
            <table className="customer-table">
              <thead>
                <tr>
                  <th>Khách hàng</th>
                  <th>Liên hệ</th>
                  <th>Đơn hàng</th>
                  <th>Chi tiêu tích lũy</th>
                  <th>Điểm tích lũy</th>
                  <th>Hạng</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((customer) => {
                  const customerOrders = getOrdersForCustomer(orders, customer, customers);
                  const deliveredOrderCount = customerOrders.filter(isDeliveredOrder).length;
                  const deliveredSpend = getDeliveredSpend(customerOrders);
                  return (
                    <tr key={customer.id}>
                      <td><strong className="customer-name">{customer.name || 'Khách hàng'}</strong></td>
                      <td><div className="customer-contact"><span>{customer.email || '—'}</span><small>{customer.phone || 'Chưa có số điện thoại'}</small></div></td>
                      <td>
                        <strong>{customerOrders.length}</strong>
                        <small className="customer-order-count-note">{deliveredOrderCount} đã giao</small>
                      </td>
                      <td><strong className="customer-spend">{formatMoney(deliveredSpend)}</strong></td>
                      <td><strong className="customer-points">{formatPoints(customer.points)}</strong></td>
                      <td><span className="customer-tier">{customer.tier || 'Đồng'}</span></td>
                      <td><span className={`customer-status ${customer.isActive === false ? 'inactive' : ''}`}>{customer.isActive === false ? 'Đã khóa' : 'Hoạt động'}</span></td>
                      <td>
                        <div className="customer-row-actions">
                          <button type="button" onClick={() => setSelectedCustomer(customer)}>Chi tiết / điểm</button>
                          <button type="button" className={customer.isActive === false ? 'activate' : 'deactivate'} onClick={() => handleToggleActive(customer)}>
                            {customer.isActive === false ? 'Mở khóa' : 'Khóa'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedCustomer && (
        <div className="customer-modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSelectedCustomer(null);
        }}>
          <section className="customer-modal" role="dialog" aria-modal="true" aria-labelledby="customer-modal-title">
            <header>
              <div><span className="customer-eyebrow">HỒ SƠ KHÁCH HÀNG</span><h3 id="customer-modal-title">{selectedCustomer.name || 'Khách hàng'}</h3></div>
              <button type="button" onClick={() => setSelectedCustomer(null)} aria-label="Đóng">×</button>
            </header>
            <div className="customer-modal-profile">
              <p><small>Email</small><strong>{selectedCustomer.email || 'Chưa cung cấp'}</strong></p>
              <p><small>Số điện thoại</small><strong>{selectedCustomer.phone || 'Chưa cung cấp'}</strong></p>
              <p><small>Chi tiêu tích lũy</small><strong>{formatMoney(selectedCustomerSpend)}</strong></p>
              <p><small>Điểm hiện có</small><strong>{formatPoints(selectedCustomer.points)}</strong></p>
              <p><small>Hạng thành viên</small><strong>{selectedCustomer.tier || 'Đồng'}</strong></p>
              <p className="customer-modal-address"><small>Địa chỉ</small><strong>{selectedCustomer.address || 'Chưa cung cấp'}</strong></p>
            </div>
            <div className="customer-point-history">
              <h4>Lịch sử điểm</h4>
              {Object.entries(selectedCustomer.pointsHistory || {})
                .map(([id, entry]) => ({ id, ...entry }))
                .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
                .slice(0, 5)
                .map((entry) => (
                  <div key={entry.id}>
                    <strong className={Number(entry.delta) >= 0 ? 'earned' : 'deducted'}>{Number(entry.delta) > 0 ? '+' : ''}{Number(entry.delta) || 0} điểm</strong>
                    <span>{entry.reason || 'Điều chỉnh điểm'}</span>
                    <small>{entry.createdAt ? new Date(entry.createdAt).toLocaleDateString('vi-VN') : '—'}</small>
                  </div>
                ))}
              {Object.keys(selectedCustomer.pointsHistory || {}).length === 0 && <p>Chưa có lịch sử điểm.</p>}
            </div>
            <div className="customer-order-history">
              <h4>Lịch sử đơn hàng ({selectedCustomerOrders.length})</h4>
              {selectedCustomerOrders.length > 0 ? (
                selectedCustomerOrders.slice(0, 5).map((order) => (
                  <div key={order.id}>
                    <strong>{order.orderNumber || order.id}</strong>
                    <span>{orderStatusLabels[order.status] || 'Chờ xác nhận'}</span>
                    <b>{Number(order.totalAmount ?? order.total ?? order.amount ?? 0).toLocaleString('vi-VN')} ₫</b>
                  </div>
                ))
              ) : <p>Chưa có đơn hàng gắn với tài khoản này.</p>}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default CustomerAccounts;
