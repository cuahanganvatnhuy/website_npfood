import { db } from './firebase';
import { ref, get, update } from 'firebase/database';
import { awardPointsForDeliveredOrder } from './loyaltyService.js';

const ordersRef = ref(db, 'orders');

export const getAllOrders = async () => {
  try {
    const snapshot = await get(ordersRef);
    const orders = [];
    if (snapshot.exists()) {
      snapshot.forEach((childSnapshot) => {
        orders.push({ id: childSnapshot.key, ...childSnapshot.val() });
      });
    }
    const getOrderTimestamp = (order) => {
      const timestamp = Date.parse(order.createdAt || order.orderDate || '');
      return Number.isFinite(timestamp) ? timestamp : 0;
    };
    orders.sort((a, b) => getOrderTimestamp(b) - getOrderTimestamp(a));
    return orders;
  } catch (error) {
    console.error('Error fetching orders:', error);
    throw error;
  }
};

export const updateOrderStatus = async (orderId, status) => {
  try {
    const orderRef = ref(db, `orders/${orderId}`);
    const snapshot = await get(orderRef);
    if (!snapshot.exists()) throw new Error('Không tìm thấy đơn hàng.');

    const order = snapshot.val();
    const updatedAt = new Date().toISOString();
    const updates = {
      status,
      updatedAt
    };
    if (status === 'delivered' && !order.deliveredAt) updates.deliveredAt = updatedAt;
    await update(orderRef, updates);

    if (status === 'delivered') {
      try {
        return {
          loyalty: await awardPointsForDeliveredOrder(orderId, {
            ...order,
            status,
            updatedAt,
            deliveredAt: order.deliveredAt || updatedAt
          })
        };
      } catch (error) {
        throw new Error(`Đã cập nhật trạng thái đơn hàng nhưng không thể cộng điểm: ${error.message}`);
      }
    }
    return { loyalty: null };
  } catch (error) {
    console.error('Error updating order status:', error);
    throw error;
  }
};

export const markOrderAsPaid = async (orderId) => {
  try {
    if (!orderId) throw new Error('Mã đơn hàng không hợp lệ.');
    const orderRef = ref(db, `orders/${orderId}`);
    const snapshot = await get(orderRef);
    if (!snapshot.exists()) throw new Error('Không tìm thấy đơn hàng.');

    const order = snapshot.val();
    if (order.paymentMethod !== 'momo') {
      throw new Error('Chỉ xác nhận thanh toán MoMo cho đơn MoMo.');
    }

    const updatedAt = new Date().toISOString();
    const paymentUpdate = {
      paymentStatus: 'paid',
      paid: true,
      paidAt: updatedAt,
      updatedAt
    };
    await update(orderRef, paymentUpdate);
    return paymentUpdate;
  } catch (error) {
    console.error('Error marking order as paid:', error);
    throw error;
  }
};
