import { get, push, ref, remove, set, update } from 'firebase/database';
import { db } from './firebase.js';
import { loyaltyTierNames } from './loyaltyTierNames.js';

const vouchersRef = ref(db, 'vouchers');
const loyaltySettingsRef = ref(db, 'loyaltySettings');

const normalizeEmail = (email) => String(email || '').trim().toLocaleLowerCase();

const getOrderCustomerId = (order, customers) => {
  const uid = String(order.customerUid || order.customer?.uid || '').trim();
  const customerEntries = Object.entries(customers);
  if (uid) {
    if (customers[uid]) return uid;
    const matches = customerEntries.filter(([, customer]) => String(customer?.uid || '').trim() === uid);
    if (matches.length === 1) return matches[0][0];
    if (matches.length > 1) return '';
  }

  const email = normalizeEmail(order.customer?.email || order.email);
  if (!email) return '';
  const matches = customerEntries.filter(([, customer]) => normalizeEmail(customer?.email) === email);
  return matches.length === 1 ? matches[0][0] : '';
};

const getOrderAmount = (order) => {
  const amount = Number(order.totalAmount ?? order.total ?? order.amount);
  return Number.isFinite(amount) && amount > 0 ? Math.floor(amount) : 0;
};

const getOrderTimestamp = (order) => {
  const timestamp = Date.parse(order.deliveredAt || order.updatedAt || order.createdAt || order.orderDate || '');
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const getRedeemedPoints = (order) => Math.max(
  0,
  Math.floor(Number(order.pointsRedeemed) || Number(order.pointsDiscountAmount) || 0)
);

export const getAllVouchers = async () => {
  try {
    const snapshot = await get(vouchersRef);
    if (!snapshot.exists()) return [];
    return Object.entries(snapshot.val())
      .map(([id, voucher]) => ({ id, ...voucher }))
      .sort((a, b) => String(a.code || '').localeCompare(String(b.code || '')));
  } catch (error) {
    console.error('Lỗi khi tải voucher:', error);
    throw error;
  }
};

export const saveVoucher = async (voucher, voucherId = '') => {
  const code = String(voucher.code || '').trim().toUpperCase();
  const audienceType = voucher.audienceType || 'all';
  const targetTier = String(voucher.targetTier || '').trim();
  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) {
    throw new Error('Mã voucher chỉ gồm 3-30 ký tự chữ, số, gạch ngang hoặc gạch dưới.');
  }
  if (!['all', 'tier'].includes(audienceType)) {
    throw new Error('Đối tượng sử dụng voucher không hợp lệ.');
  }
  if (audienceType === 'tier' && !targetTier) {
    throw new Error('Chọn hạng thành viên được sử dụng voucher này.');
  }
  const discountValue = Number(voucher.discountValue);
  if (!['percent', 'fixed'].includes(voucher.discountType) ||
      !Number.isFinite(discountValue) ||
      discountValue <= 0 ||
      (voucher.discountType === 'percent' && discountValue > 100)) {
    throw new Error('Mức giảm giá không hợp lệ.');
  }
  if ((Number(voucher.minOrder) || 0) < 0 || (Number(voucher.usageLimit) || 0) < 0) {
    throw new Error('Đơn tối thiểu và giới hạn lượt dùng không được âm.');
  }
  if (!String(voucher.name || '').trim()) {
    throw new Error('Tên chương trình không được để trống.');
  }
  if (voucher.startsAt && voucher.expiresAt &&
      new Date(voucher.startsAt).getTime() >= new Date(voucher.expiresAt).getTime()) {
    throw new Error('Ngày kết thúc phải sau ngày bắt đầu.');
  }

  try {
    const allVouchers = await getAllVouchers();
    if (allVouchers.some((item) => item.id !== voucherId && item.code === code)) {
      throw new Error('Mã voucher này đã tồn tại.');
    }

    const data = {
      name: String(voucher.name || '').trim(),
      code,
      discountType: voucher.discountType,
      discountValue,
      audienceType,
      targetTier: audienceType === 'tier' ? targetTier : '',
      minOrder: Number(voucher.minOrder) || 0,
      usageLimit: Number(voucher.usageLimit) || 0,
      isActive: Boolean(voucher.isActive),
      startsAt: voucher.startsAt || '',
      expiresAt: voucher.expiresAt || '',
      updatedAt: new Date().toISOString()
    };

    if (voucherId) {
      await update(ref(db, `vouchers/${voucherId}`), data);
      return voucherId;
    }

    const voucherRef = push(vouchersRef);
    await set(voucherRef, { ...data, usedCount: 0, createdAt: new Date().toISOString() });
    return voucherRef.key;
  } catch (error) {
    console.error('Lỗi khi lưu voucher:', error);
    throw error;
  }
};

export const hideVoucher = async (voucherId) => {
  try {
    await update(ref(db, `vouchers/${voucherId}`), {
      isActive: false,
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Lỗi khi xóa voucher:', error);
    throw error;
  }
};

export const deleteVoucher = async (voucherId) => {
  if (!voucherId) throw new Error('Không xác định được voucher cần xóa.');
  try {
    await remove(ref(db, `vouchers/${voucherId}`));
  } catch (error) {
    console.error('Lỗi khi xóa voucher:', error);
    throw error;
  }
};

export const getLoyaltySettings = async () => {
  try {
    const snapshot = await get(loyaltySettingsRef);
    const settings = snapshot.exists() ? snapshot.val() : {
      amountPerPoint: 1000,
      pointsPerAmount: 1,
      tiers: loyaltyTierNames.map((name, index) => ({
        name,
        minPoints: index === 0 ? 0 : ''
      }))
    };
    const savedTiers = Array.isArray(settings.tiers)
      ? [...settings.tiers].sort((a, b) => Number(a.minPoints || 0) - Number(b.minPoints || 0))
      : [];
    return {
      ...settings,
      tiers: loyaltyTierNames.map((name, index) => ({
        name,
        minPoints: index === 0 ? 0 : savedTiers[index]?.minPoints ?? ''
      }))
    };
  } catch (error) {
    console.error('Lỗi khi tải cấu hình tích điểm:', error);
    throw error;
  }
};

export const saveLoyaltySettings = async (settings) => {
  if (!Array.isArray(settings.tiers) || settings.tiers.length !== loyaltyTierNames.length) {
    throw new Error('Cấu hình phải có đủ bốn hạng Đồng, Bạc, Vàng và Kim cương.');
  }
  const tiers = loyaltyTierNames.map((name, index) => {
    const rawMinimum = settings.tiers[index]?.minPoints;
    if (rawMinimum === '' || rawMinimum === null || rawMinimum === undefined) {
      throw new Error(`Vui lòng nhập mốc điểm cho hạng ${name}.`);
    }
    const minPoints = Number(rawMinimum);
    if (!Number.isInteger(minPoints) || minPoints < 0) {
      throw new Error(`Mốc điểm của hạng ${name} phải là số nguyên không âm.`);
    }
    return { name, minPoints };
  });
  if (tiers[0].minPoints !== 0) throw new Error('Hạng Đồng phải bắt đầu từ 0 điểm.');
  if (tiers.some((tier, index) => index > 0 && tier.minPoints <= tiers[index - 1].minPoints)) {
    throw new Error('Mốc điểm phải tăng dần theo thứ tự Đồng, Bạc, Vàng, Kim cương.');
  }

  try {
    const updatedAt = new Date().toISOString();
    const settingsData = {
      amountPerPoint: Math.max(1, Math.floor(Number(settings.amountPerPoint) || 1)),
      pointsPerAmount: Math.max(1, Math.floor(Number(settings.pointsPerAmount) || 1)),
      tiers,
      updatedAt
    };
    const updates = { loyaltySettings: settingsData };
    const [customerSnapshot, orderSnapshot] = await Promise.all([
      get(ref(db, 'customers')),
      get(ref(db, 'orders'))
    ]);
    const customers = customerSnapshot.exists() ? customerSnapshot.val() : {};
    const orders = orderSnapshot.exists()
      ? Object.entries(orderSnapshot.val()).map(([id, order]) => ({ id, ...order }))
      : [];
    const deliveredOrdersByCustomer = new Map();
    const redeemedPointsByCustomer = new Map();

    orders.forEach((order) => {
      const customerId = getOrderCustomerId(order, customers);
      if (!customerId) return;

      const redeemedPoints = getRedeemedPoints(order);
      if (redeemedPoints > 0) {
        redeemedPointsByCustomer.set(
          customerId,
          (redeemedPointsByCustomer.get(customerId) || 0) + redeemedPoints
        );
      }

      if (String(order.status || '').trim().toLocaleLowerCase() !== 'delivered') return;
      if (getOrderAmount(order) <= 0) return;
      const customerOrders = deliveredOrdersByCustomer.get(customerId) || [];
      customerOrders.push(order);
      deliveredOrdersByCustomer.set(customerId, customerOrders);
    });

    Object.entries(customers).forEach(([customerId, customer]) => {
      const customerOrders = (deliveredOrdersByCustomer.get(customerId) || [])
        .sort((a, b) => getOrderTimestamp(a) - getOrderTimestamp(b));
      let lifetimeSpend = 0;
      let spendRemainder = 0;
      let earnedPoints = 0;
      const existingHistoryByOrder = new Map(
        Object.entries(customer.pointsHistory || {})
          .filter(([, entry]) => entry.orderId)
          .map(([historyId, entry]) => [entry.orderId, historyId])
      );

      customerOrders.forEach((order) => {
        const amount = getOrderAmount(order);
        const accumulatedSpend = spendRemainder + amount;
        const orderPoints = Math.floor(accumulatedSpend / settingsData.amountPerPoint) *
          settingsData.pointsPerAmount;
        spendRemainder = accumulatedSpend % settingsData.amountPerPoint;
        lifetimeSpend += amount;
        earnedPoints += orderPoints;

        const historyId = customer.loyaltyOrders?.[order.id]?.historyId ||
          existingHistoryByOrder.get(order.id) ||
          push(ref(db, `customers/${customerId}/pointsHistory`)).key;
        if (!historyId) throw new Error(`Không thể tạo lịch sử điểm cho đơn ${order.orderNumber || order.id}.`);
        const appliedAt = order.deliveredAt || order.updatedAt || order.createdAt || updatedAt;
        const resolvedCustomerUid = String(customer.uid || customerId);

        updates[`customers/${customerId}/loyaltyOrders/${order.id}`] = {
          amount,
          points: orderPoints,
          historyId,
          createdAt: appliedAt
        };
        updates[`customers/${customerId}/pointsHistory/${historyId}`] = {
          delta: orderPoints,
          reason: `Đơn ${order.orderNumber || order.id}: ${amount.toLocaleString('vi-VN')} ₫; chi tiêu tích lũy ${lifetimeSpend.toLocaleString('vi-VN')} ₫`,
          type: 'purchase',
          orderId: order.id,
          amount,
          lifetimeSpend,
          createdAt: appliedAt
        };
        updates[`orders/${order.id}/customerUid`] = resolvedCustomerUid;
        updates[`orders/${order.id}/loyaltyPointsAwarded`] = true;
        updates[`orders/${order.id}/loyaltyPointsAwardedPoints`] = orderPoints;
        updates[`orders/${order.id}/loyaltyPointsAwardedAmount`] = amount;
        updates[`orders/${order.id}/loyaltyPointsAwardedAt`] = appliedAt;
      });

      const points = Math.max(
        0,
        earnedPoints - (redeemedPointsByCustomer.get(customerId) || 0)
      );
      const currentTier = tiers
        .filter((tier) => points >= tier.minPoints)
        .slice(-1)[0];
      updates[`customers/${customerId}/points`] = points;
      updates[`customers/${customerId}/lifetimeSpend`] = lifetimeSpend;
      updates[`customers/${customerId}/loyaltySpendRemainder`] = spendRemainder;
      updates[`customers/${customerId}/tier`] = currentTier?.name || tiers[0].name;
      updates[`customers/${customerId}/updatedAt`] = updatedAt;
    });

    await update(ref(db), updates);
    return settingsData;
  } catch (error) {
    console.error('Lỗi khi lưu cấu hình tích điểm:', error);
    throw error;
  }
};
