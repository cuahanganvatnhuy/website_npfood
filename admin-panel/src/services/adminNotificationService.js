import { get, onChildAdded, onValue, ref, update } from 'firebase/database';
import { auth, db } from './firebase.js';

const NOTIFICATIONS_STORAGE_KEY = 'npfood-admin-notifications';
const SETTINGS_STORAGE_KEY = 'npfood-admin-notification-settings';
const MAX_STORED_NOTIFICATIONS = 100;
const EMAIL_SETTINGS_PATH = 'adminSettings/emailNotifications';
const EMAIL_WEBHOOK_PATH = 'publicConfig/emailNotificationWebhookUrl';

export const defaultAdminNotificationSettings = {
  orders: true,
  contactMessages: true,
  lowStock: true
};

export const defaultAdminEmailNotificationSettings = {
  enabled: false,
  recipientEmail: '',
  appsScriptUrl: '',
  orders: true
};

export const loadAdminEmailNotificationSettings = async () => {
  const snapshot = await get(ref(db, EMAIL_SETTINGS_PATH));
  const stored = snapshot.val() || {};
  return {
    enabled: stored.enabled === true,
    recipientEmail: typeof stored.recipientEmail === 'string' ? stored.recipientEmail : '',
    appsScriptUrl: typeof stored.appsScriptUrl === 'string' ? stored.appsScriptUrl : '',
    orders: stored.orders !== false
  };
};

const isAppsScriptUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      url.hostname === 'script.google.com' &&
      /^\/macros\/s\/[^/]+\/exec\/?$/.test(url.pathname);
  } catch {
    return false;
  }
};

const postToAppsScript = async (url, payload) => {
  await fetch(url, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: new URLSearchParams({ payload: JSON.stringify(payload) })
  });
};

export const saveAdminEmailNotificationSettings = async (settings) => {
  const recipientEmail = String(settings.recipientEmail || '').trim();
  const appsScriptUrl = String(settings.appsScriptUrl || '').trim();
  if (settings.enabled && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
    throw new Error('Hãy nhập địa chỉ Gmail nhận thông báo hợp lệ.');
  }
  if (settings.enabled && !isAppsScriptUrl(appsScriptUrl)) {
    throw new Error('Hãy nhập URL triển khai Web App Apps Script hợp lệ.');
  }
  if (appsScriptUrl && !isAppsScriptUrl(appsScriptUrl)) {
    throw new Error('URL Apps Script không hợp lệ.');
  }

  const savedSettings = {
    enabled: Boolean(settings.enabled),
    recipientEmail,
    orders: Boolean(settings.orders),
    appsScriptUrl,
    updatedAt: new Date().toISOString()
  };
  await update(ref(db), {
    [EMAIL_SETTINGS_PATH]: savedSettings,
    [EMAIL_WEBHOOK_PATH]: appsScriptUrl || null
  });

  if (appsScriptUrl) {
    const user = auth.currentUser;
    if (!user) throw new Error('Hãy đăng nhập quản trị viên trước khi lưu cài đặt Gmail.');
    const idToken = await user.getIdToken();
    try {
      await postToAppsScript(appsScriptUrl, {
        action: 'configure',
        idToken,
        settings: {
          enabled: savedSettings.enabled,
          recipientEmail,
          orders: savedSettings.orders
        }
      });
    } catch (error) {
      throw new Error(`Đã lưu cài đặt Firebase nhưng không gọi được Apps Script: ${error.message}`);
    }
  }
};

export const sendAdminEmailTest = async (settings) => {
  const appsScriptUrl = String(settings?.appsScriptUrl || '').trim();
  if (!isAppsScriptUrl(appsScriptUrl)) {
    throw new Error('Hãy nhập và lưu URL triển khai Apps Script trước khi gửi email thử.');
  }
  const user = auth.currentUser;
  if (!user) throw new Error('Hãy đăng nhập quản trị viên trước khi gửi email thử.');
  const idToken = await user.getIdToken();
  await postToAppsScript(appsScriptUrl, { action: 'test', idToken });
};

export const loadAdminNotificationSettings = () => {
  try {
    const stored = JSON.parse(window.localStorage.getItem(SETTINGS_STORAGE_KEY) || '{}');
    return {
      orders: stored.orders !== false,
      contactMessages: stored.contactMessages !== false,
      lowStock: stored.lowStock !== false
    };
  } catch (error) {
    console.error('Không thể tải cài đặt thông báo:', error);
    return { ...defaultAdminNotificationSettings };
  }
};

export const saveAdminNotificationSettings = (settings) => {
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Không thể lưu cài đặt thông báo:', error);
    throw error;
  }
};

export const loadAdminNotifications = () => {
  try {
    const stored = JSON.parse(window.localStorage.getItem(NOTIFICATIONS_STORAGE_KEY) || '[]');
    return Array.isArray(stored) ? stored.slice(0, MAX_STORED_NOTIFICATIONS) : [];
  } catch (error) {
    console.error('Không thể tải thông báo đã lưu:', error);
    return [];
  }
};

export const saveAdminNotifications = (notifications) => {
  try {
    window.localStorage.setItem(
      NOTIFICATIONS_STORAGE_KEY,
      JSON.stringify(notifications.slice(0, MAX_STORED_NOTIFICATIONS))
    );
  } catch (error) {
    console.error('Không thể lưu thông báo:', error);
  }
};

const createChildListener = async ({
  path,
  enabled,
  createNotification,
  onNotification,
  onError,
  isActive,
  addUnsubscriber
}) => {
  if (!enabled) return;
  const nodeRef = ref(db, path);
  try {
    const initialSnapshot = await get(nodeRef);
    if (!isActive()) return;

    const existingIds = new Set();
    initialSnapshot.forEach((childSnapshot) => existingIds.add(childSnapshot.key));
    const unsubscribe = onChildAdded(
      nodeRef,
      (childSnapshot) => {
        if (existingIds.has(childSnapshot.key)) return;
        existingIds.add(childSnapshot.key);
        onNotification(createNotification(childSnapshot));
      },
      onError
    );
    addUnsubscriber(unsubscribe);
  } catch (error) {
    if (isActive()) onError(error);
  }
};

const getStockValue = (product) => {
  if (product.stock === null || product.stock === undefined || product.stock === '') return null;
  const stock = Number(product.stock);
  return Number.isFinite(stock) ? stock : null;
};

export const subscribeToAdminNotifications = (settings, onNotification, onError) => {
  let active = true;
  let previousProducts = null;
  const unsubscribers = [];
  const addUnsubscriber = (unsubscribe) => unsubscribers.push(unsubscribe);
  const reportError = (error) => {
    console.error('Lỗi đồng bộ thông báo admin:', error);
    if (active) onError(error);
  };
  const createListener = (path, enabled, createNotification) => createChildListener({
    path,
    enabled,
    createNotification,
    onNotification,
    onError: reportError,
    isActive: () => active,
    addUnsubscriber
  });

  createListener('orders', settings.orders, (snapshot) => {
    const order = snapshot.val() || {};
    const orderNumber = order.orderNumber || snapshot.key;
    const customerName = order.customer?.name || order.customerName || order.name || 'Khách hàng';
    return {
      id: `order:${snapshot.key}`,
      type: 'order',
      title: 'Bạn có đơn hàng mới',
      message: `${customerName} vừa đặt đơn #${orderNumber}.`,
      createdAt: order.createdAt || order.orderDate || new Date().toISOString(),
      link: '/orders',
      read: false
    };
  }).catch(reportError);

  createListener('contactMessages', settings.contactMessages, (snapshot) => {
    const message = snapshot.val() || {};
    const senderName = message.name || message.email || 'Khách hàng';
    return {
      id: `contact:${snapshot.key}`,
      type: 'contact',
      title: 'Bạn có tin nhắn liên hệ mới',
      message: `Tin nhắn từ ${senderName}.`,
      createdAt: message.createdAt || new Date().toISOString(),
      link: '/contact-messages',
      read: false
    };
  }).catch(reportError);

  if (settings.lowStock) {
    const productsRef = ref(db, 'products');
    const unsubscribe = onValue(productsRef, (snapshot) => {
      const currentProducts = new Map();
      snapshot.forEach((productSnapshot) => {
        currentProducts.set(productSnapshot.key, productSnapshot.val() || {});
      });

      if (previousProducts) {
        currentProducts.forEach((product, productId) => {
          if (product.isActive === false) return;
          const stock = getStockValue(product);
          if (stock === null || stock > 5) return;

          const previousProduct = previousProducts.get(productId);
          const previousStock = previousProduct ? getStockValue(previousProduct) : null;
          if (previousProduct && (previousStock === null || previousStock <= 5)) return;

          const productName = product.name || 'Sản phẩm';
          onNotification({
            id: `stock:${productId}:${Date.now()}`,
            type: 'inventory',
            title: stock <= 0 ? 'Sản phẩm đã hết hàng' : 'Sản phẩm sắp hết hàng',
            message: stock <= 0 ? `${productName} hiện đã hết hàng.` : `${productName} chỉ còn ${stock} sản phẩm.`,
            createdAt: new Date().toISOString(),
            link: '/products',
            read: false
          });
        });
      }

      previousProducts = currentProducts;
    }, reportError);
    addUnsubscriber(unsubscribe);
  }

  return () => {
    active = false;
    unsubscribers.forEach((unsubscribe) => unsubscribe());
  };
};
