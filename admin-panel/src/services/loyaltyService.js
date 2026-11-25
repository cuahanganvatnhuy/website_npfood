import { get, push, ref, runTransaction, update } from 'firebase/database';
import { db } from './firebase.js';
import { normalizeLoyaltyTiers } from './loyaltyTierNames.js';

const normalizeEmail = (email) => String(email || '').trim().toLocaleLowerCase();

const getOrderEmail = (order) => normalizeEmail(order.customer?.email || order.email);

const getOrderAmount = (order) => Number(order.totalAmount ?? order.total ?? order.amount);

const isDelivered = (order) => String(order.status || '').trim().toLocaleLowerCase() === 'delivered';

const getSettings = (value) => ({
  amountPerPoint: Math.max(1, Math.floor(Number(value?.amountPerPoint) || 1000)),
  pointsPerAmount: Math.max(1, Math.floor(Number(value?.pointsPerAmount) || 1)),
  tiers: normalizeLoyaltyTiers(value?.tiers)
});

export const calculateLoyaltyAccrual = ({
  spendRemainder,
  amount,
  amountPerPoint,
  pointsPerAmount
}) => {
  const threshold = Math.max(1, Math.floor(Number(amountPerPoint) || 1));
  const pointsPerBlock = Math.max(1, Math.floor(Number(pointsPerAmount) || 1));
  const accumulatedSpend = Math.max(0, Math.floor(Number(spendRemainder) || 0)) +
    Math.max(0, Math.floor(Number(amount) || 0));

  return {
    points: Math.floor(accumulatedSpend / threshold) * pointsPerBlock,
    remainder: accumulatedSpend % threshold
  };
};

const getLoyaltyData = async () => {
  const [customersSnapshot, settingsSnapshot] = await Promise.all([
    get(ref(db, 'customers')),
    get(ref(db, 'loyaltySettings'))
  ]);
  const customers = customersSnapshot.exists() ? customersSnapshot.val() : {};
  const settings = getSettings(settingsSnapshot.exists() ? settingsSnapshot.val() : null);
  return { customers, settings };
};

const applyPointsToOrder = async (orderId, order, customers, settings) => {
  if (!isDelivered(order)) return { status: 'not_delivered' };
  if (order.loyaltyPointsAwarded) {
    return {
      status: 'already_applied',
      points: Number(order.loyaltyPointsAwardedPoints) || 0
    };
  }

  const customerUid = String(order.customerUid || order.customer?.uid || '').trim();
  const email = getOrderEmail(order);
  let matches = [];
  if (customerUid) {
    if (customers[customerUid]) {
      matches = [[customerUid, customers[customerUid]]];
    } else {
      matches = Object.entries(customers)
        .filter(([, customer]) => String(customer?.uid || '').trim() === customerUid);
    }
    if (matches.length === 0 && email) {
      matches = Object.entries(customers)
        .filter(([, customer]) => normalizeEmail(customer?.email) === email);
    }
  } else if (email) {
    matches = Object.entries(customers)
      .filter(([, customer]) => normalizeEmail(customer?.email) === email);
  }
  if (!customerUid && !email) return { status: 'missing_email' };
  if (matches.length === 0) {
    return customerUid
      ? {
        status: 'customer_uid_not_found',
        orderUid: customerUid,
        orderLabel: order.orderNumber || orderId
      }
      : { status: 'customer_not_found' };
  }
  if (matches.length > 1) return { status: 'ambiguous_customer' };

  const amount = getOrderAmount(order);
  if (!Number.isFinite(amount) || amount <= 0) return { status: 'invalid_amount' };

  const [customerId, customer] = matches[0];
  const resolvedCustomerUid = String(customer?.uid || customerId);
  const customerRef = ref(db, `customers/${customerId}`);
  const historyId = push(ref(db, `customers/${customerId}/pointsHistory`)).key;
  const appliedAt = order.deliveredAt || order.updatedAt || new Date().toISOString();
  const orderLabel = order.orderNumber || orderId;
  const transaction = await runTransaction(customerRef, (customer) => {
    if (!customer) return;
    if (customer.loyaltyOrders?.[orderId]) return customer;

    const lifetimeSpend = Math.max(0, Number(customer.lifetimeSpend) || 0);
    const hasRemainder = customer.loyaltySpendRemainder !== undefined &&
      customer.loyaltySpendRemainder !== null;
    const spendRemainder = hasRemainder
      ? Math.max(0, Number(customer.loyaltySpendRemainder) || 0)
      : lifetimeSpend % settings.amountPerPoint;
    const accrual = calculateLoyaltyAccrual({
      spendRemainder,
      amount,
      amountPerPoint: settings.amountPerPoint,
      pointsPerAmount: settings.pointsPerAmount
    });
    const nextLifetimeSpend = lifetimeSpend + amount;
    const points = Math.max(0, (Number(customer.points) || 0) + accrual.points);
    const matchingTiers = settings.tiers
      .filter((tier) => points >= Number(tier.minPoints || 0));
    const currentTier = matchingTiers[matchingTiers.length - 1];
    const reason = `Đơn ${orderLabel}: ${amount.toLocaleString('vi-VN')} ₫; chi tiêu tích lũy ${nextLifetimeSpend.toLocaleString('vi-VN')} ₫`;

    return {
      ...customer,
      points,
      lifetimeSpend: nextLifetimeSpend,
      loyaltySpendRemainder: accrual.remainder,
      tier: currentTier?.name || customer.tier || 'Đồng',
      loyaltyOrders: {
        ...(customer.loyaltyOrders || {}),
        [orderId]: {
          amount,
          points: accrual.points,
          historyId,
          createdAt: appliedAt
        }
      },
      pointsHistory: {
        ...(customer.pointsHistory || {}),
        [historyId]: {
          delta: accrual.points,
          reason,
          type: 'purchase',
          orderId,
          amount,
          lifetimeSpend: nextLifetimeSpend,
          createdAt: appliedAt
        }
      },
      updatedAt: new Date().toISOString()
    };
  });

  const updatedCustomer = transaction.snapshot.val();
  if (!transaction.committed && !updatedCustomer?.loyaltyOrders?.[orderId]) {
    if (!updatedCustomer) {
      return customerUid
        ? {
          status: 'customer_uid_not_found',
          orderUid: customerUid,
          orderLabel
        }
        : { status: 'customer_not_found', orderLabel };
    }

    return {
      status: 'loyalty_transaction_not_committed',
      orderUid: resolvedCustomerUid,
      customerId,
      orderLabel
    };
  }

  const award = updatedCustomer.loyaltyOrders?.[orderId];
  if (!award) throw new Error(`Không thể xác nhận điểm thưởng cho đơn ${orderLabel}.`);

  await update(ref(db, `orders/${orderId}`), {
    customerUid: resolvedCustomerUid,
    loyaltyPointsAwarded: true,
    loyaltyPointsAwardedPoints: Number(award.points) || 0,
    loyaltyPointsAwardedAmount: Number(award.amount) || amount,
    loyaltyPointsAwardedAt: award.createdAt || appliedAt
  });

  return {
    status: award.historyId === historyId ? 'awarded' : 'already_applied',
    customerId,
    points: Number(award.points) || 0,
    amount: Number(award.amount) || amount
  };
};

export const awardPointsForDeliveredOrder = async (orderId, order) => {
  try {
    const { customers, settings } = await getLoyaltyData();
    return await applyPointsToOrder(orderId, order, customers, settings);
  } catch (error) {
    console.error('Lỗi khi cộng điểm cho đơn hàng:', error);
    throw error;
  }
};

export const backfillDeliveredOrderPoints = async () => {
  try {
    const [ordersSnapshot, { customers, settings }] = await Promise.all([
      get(ref(db, 'orders')),
      getLoyaltyData()
    ]);
    const orders = ordersSnapshot.exists()
      ? Object.entries(ordersSnapshot.val())
        .map(([id, order]) => ({ id, ...order }))
        .filter(isDelivered)
        .sort((a, b) => new Date(a.createdAt || a.orderDate || 0) - new Date(b.createdAt || b.orderDate || 0))
      : [];
    const report = {
      checked: orders.length,
      awarded: 0,
      alreadyApplied: 0,
      missingEmail: 0,
      customerNotFound: 0,
      customerUidNotFound: 0,
      customerUidMismatches: [],
      loyaltyTransactionNotCommitted: 0,
      loyaltyTransactionFailures: [],
      ambiguousCustomer: 0,
      invalidAmount: 0,
      failed: 0,
      failures: []
    };

    for (const order of orders) {
      try {
        const result = await applyPointsToOrder(order.id, order, customers, settings);
        if (result.status === 'awarded') report.awarded += 1;
        else if (result.status === 'already_applied') report.alreadyApplied += 1;
        else if (result.status === 'missing_email') report.missingEmail += 1;
        else if (result.status === 'customer_not_found') report.customerNotFound += 1;
        else if (result.status === 'customer_uid_not_found') {
          report.customerUidNotFound += 1;
          report.customerUidMismatches.push({
            orderLabel: result.orderLabel,
            orderUid: result.orderUid
          });
        } else if (result.status === 'loyalty_transaction_not_committed') {
          report.loyaltyTransactionNotCommitted += 1;
          report.loyaltyTransactionFailures.push({
            orderLabel: result.orderLabel,
            orderUid: result.orderUid,
            customerId: result.customerId
          });
        }
        else if (result.status === 'ambiguous_customer') report.ambiguousCustomer += 1;
        else if (result.status === 'invalid_amount') report.invalidAmount += 1;
      } catch (error) {
        report.failed += 1;
        report.failures.push({ orderId: order.id, message: error.message || 'Lỗi không xác định.' });
        console.error(`Lỗi backfill điểm cho đơn ${order.id}:`, error);
      }
    }

    return report;
  } catch (error) {
    console.error('Lỗi khi cập nhật điểm từ lịch sử đơn hàng:', error);
    throw error;
  }
};
