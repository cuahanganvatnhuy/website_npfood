import { get, push, ref, runTransaction, update } from 'firebase/database';
import { db } from './firebase.js';
import { normalizeLoyaltyTiers } from './loyaltyTierNames.js';

export const getAllCustomers = async () => {
  try {
    const snapshot = await get(ref(db, 'customers'));
    if (!snapshot.exists()) return [];
    return Object.entries(snapshot.val())
      .map(([id, customer]) => ({ id, ...customer }))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'vi'));
  } catch (error) {
    console.error('Lỗi khi tải tài khoản khách hàng:', error);
    throw error;
  }
};

export const updateCustomer = async (customerId, customerData) => {
  try {
    await update(ref(db, `customers/${customerId}`), {
      ...customerData,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật tài khoản khách hàng:', error);
    throw error;
  }
};

export const adjustCustomerPoints = async (customerId, delta, reason) => {
  if (!Number.isInteger(delta) || delta === 0) {
    throw new Error('Số điểm điều chỉnh phải là số nguyên khác 0.');
  }

  try {
    const customerRef = ref(db, `customers/${customerId}`);
    const historyId = push(ref(db, `customers/${customerId}/pointsHistory`)).key;
    const settingsSnapshot = await get(ref(db, 'loyaltySettings'));
    const tiers = normalizeLoyaltyTiers(settingsSnapshot.val()?.tiers);
    const transaction = await runTransaction(customerRef, (customer) => {
      if (!customer) return;
      const points = Math.max(0, (Number(customer.points) || 0) + delta);
      const currentTier = tiers
        .filter((tier) => points >= tier.minPoints)
        .slice(-1)[0];
      return {
        ...customer,
        points,
        tier: currentTier?.name || customer.tier || 'Đồng',
        pointsHistory: {
          ...(customer.pointsHistory || {}),
          [historyId]: {
            delta,
            reason: String(reason || '').trim(),
            createdAt: new Date().toISOString()
          }
        },
        updatedAt: new Date().toISOString()
      };
    });
    if (!transaction.committed) throw new Error('Không tìm thấy tài khoản khách hàng.');
    return transaction.snapshot.val();
  } catch (error) {
    console.error('Lỗi khi điều chỉnh điểm khách hàng:', error);
    throw error;
  }
};
