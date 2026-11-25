const { createHash } = require('node:crypto');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const logger = require('firebase-functions/logger');
const { defineSecret } = require('firebase-functions/params');
const { onValueCreated, onValueWritten } = require('firebase-functions/v2/database');
const { HttpsError, onCall } = require('firebase-functions/v2/https');

admin.initializeApp();

const database = admin.database();
const gmailUser = defineSecret('GMAIL_USER');
const gmailAppPassword = defineSecret('GMAIL_APP_PASSWORD');
const emailSettingsPath = 'adminSettings/emailNotifications';
const deliveryPath = 'adminEmailNotificationDeliveries';
const adminEmail = 'admin@gmail.com';

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const isValidEmail = (value) => (
  typeof value === 'string'
  && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
);

const safeSubjectValue = (value) => String(value).replace(/[\r\n]/g, ' ').slice(0, 160);

const getStockValue = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const stock = Number(value);
  return Number.isFinite(stock) ? stock : null;
};

const getMailer = () => {
  const user = gmailUser.value().trim();
  const password = gmailAppPassword.value().replace(/\s/g, '');
  if (!user || !password) {
    throw new Error('Gmail sender secrets are not configured.');
  }

  return {
    user,
    transport: nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass: password }
    })
  };
};

const getEnabledEmailSettings = async (eventType) => {
  const snapshot = await database.ref(emailSettingsPath).get();
  const settings = snapshot.val();
  if (!settings?.enabled || settings[eventType] !== true) return null;

  if (!isValidEmail(settings.recipientEmail)) {
    logger.error('Email notifications are enabled but the recipient address is invalid.');
    return null;
  }
  return settings;
};

const claimDelivery = async (eventId) => {
  const key = createHash('sha256').update(eventId).digest('hex');
  const deliveryRef = database.ref(`${deliveryPath}/${key}`);
  const now = Date.now();
  const result = await deliveryRef.transaction((current) => {
    if (current?.status === 'sent') return;
    if (current?.status === 'sending' && now - current.startedAt < 5 * 60 * 1000) return;
    return { status: 'sending', startedAt: now };
  });
  return result.committed ? deliveryRef : null;
};

const sendNotificationEmail = async ({ eventId, eventType, subject, text, html }) => {
  const settings = await getEnabledEmailSettings(eventType);
  if (!settings) {
    logger.info('Email notification skipped because it is disabled or not configured.', { eventType });
    return;
  }

  const deliveryRef = await claimDelivery(eventId);
  if (!deliveryRef) return;

  try {
    const { user, transport } = getMailer();
    const result = await transport.sendMail({
      from: `"NP FOOD" <${user}>`,
      to: settings.recipientEmail.trim(),
      subject,
      text,
      html
    });
    await deliveryRef.set({ status: 'sent', sentAt: Date.now() });
    logger.info('Admin email notification sent.', { eventType, messageId: result.messageId });
  } catch (error) {
    await deliveryRef.set({ status: 'failed', failedAt: Date.now() });
    logger.error('Could not send admin email notification.', { eventType, error });
    throw error;
  }
};

exports.notifyNewOrder = onValueCreated({
  ref: '/orders/{orderId}',
  region: 'us-central1',
  retry: true,
  secrets: [gmailUser, gmailAppPassword]
}, async (event) => {
  const order = event.data.val() || {};
  const orderNumber = order.orderNumber || event.params.orderId;
  const customerName = order.customer?.name || order.customerName || order.name || 'Khách hàng';
  const subject = `NP FOOD: Bạn có đơn hàng mới #${safeSubjectValue(orderNumber)}`;
  const text = `${customerName} vừa đặt đơn hàng #${orderNumber}. Vui lòng mở trang quản trị để xem chi tiết.`;
  const html = `<p><strong>${escapeHtml(customerName)}</strong> vừa đặt đơn hàng <strong>#${escapeHtml(orderNumber)}</strong>.</p><p>Vui lòng mở trang quản trị NP FOOD để xem chi tiết đơn hàng.</p>`;

  await sendNotificationEmail({
    eventId: event.id,
    eventType: 'orders',
    subject,
    text,
    html
  });
});

exports.notifyContactMessage = onValueCreated({
  ref: '/contactMessages/{messageId}',
  region: 'us-central1',
  retry: true,
  secrets: [gmailUser, gmailAppPassword]
}, async (event) => {
  const message = event.data.val() || {};
  const senderName = message.name || message.email || 'Khách hàng';
  const subject = 'NP FOOD: Bạn có tin nhắn liên hệ mới';
  const text = `Bạn có tin nhắn liên hệ mới từ ${senderName}. Vui lòng mở trang quản trị để xem nội dung.`;
  const html = `<p>Bạn có tin nhắn liên hệ mới từ <strong>${escapeHtml(senderName)}</strong>.</p><p>Vui lòng mở trang quản trị NP FOOD để xem nội dung.</p>`;

  await sendNotificationEmail({
    eventId: event.id,
    eventType: 'contactMessages',
    subject,
    text,
    html
  });
});

exports.notifyLowStock = onValueWritten({
  ref: '/products/{productId}',
  region: 'us-central1',
  retry: true,
  secrets: [gmailUser, gmailAppPassword]
}, async (event) => {
  const previousProduct = event.data.before.val();
  const product = event.data.after.val();
  if (!product || product.isActive === false) return;

  const stock = getStockValue(product.stock);
  if (stock === null || stock > 5) return;

  if (previousProduct) {
    const previousStock = getStockValue(previousProduct.stock);
    if (previousStock !== null && previousStock <= 5) return;
  }

  const productName = product.name || 'Sản phẩm';
  const subject = stock <= 0
    ? `NP FOOD: Sản phẩm đã hết hàng - ${safeSubjectValue(productName)}`
    : `NP FOOD: Sản phẩm sắp hết hàng - ${safeSubjectValue(productName)}`;
  const text = stock <= 0
    ? `${productName} hiện đã hết hàng.`
    : `${productName} chỉ còn ${stock} sản phẩm.`;
  const html = stock <= 0
    ? `<p><strong>${escapeHtml(productName)}</strong> hiện đã hết hàng.</p>`
    : `<p><strong>${escapeHtml(productName)}</strong> chỉ còn <strong>${stock}</strong> sản phẩm.</p>`;

  await sendNotificationEmail({
    eventId: event.id,
    eventType: 'lowStock',
    subject,
    text,
    html
  });
});

exports.sendTestNotificationEmail = onCall({
  region: 'us-central1',
  secrets: [gmailUser, gmailAppPassword]
}, async (request) => {
  if (request.auth?.token.email?.toLowerCase() !== adminEmail) {
    throw new HttpsError('permission-denied', 'Chỉ quản trị viên mới được gửi email kiểm tra.');
  }

  const snapshot = await database.ref(emailSettingsPath).get();
  const settings = snapshot.val();
  if (!isValidEmail(settings?.recipientEmail)) {
    throw new HttpsError('failed-precondition', 'Hãy lưu địa chỉ Gmail nhận thông báo trước.');
  }

  try {
    const { user, transport } = getMailer();
    await transport.sendMail({
      from: `"NP FOOD" <${user}>`,
      to: settings.recipientEmail.trim(),
      subject: 'NP FOOD: Email kiểm tra cài đặt',
      text: 'Gửi thành công. Cài đặt gửi thông báo Gmail đang hoạt động.',
      html: '<p>Gửi thành công. Cài đặt gửi thông báo Gmail đang hoạt động.</p>'
    });
    return { success: true };
  } catch (error) {
    logger.error('Could not send test notification email.', { error });
    throw new HttpsError(
      'internal',
      'Không gửi được email kiểm tra. Hãy kiểm tra Gmail App Password và cấu hình Cloud Functions.'
    );
  }
});
