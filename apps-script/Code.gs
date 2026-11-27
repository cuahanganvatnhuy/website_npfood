const FIREBASE_API_KEY = 'AIzaSyBE3I9inSpoRbkhmf8iaRANtxI5jqL0X2s';
const FIREBASE_DATABASE_URL = 'https://course-management-e4a28-default-rtdb.firebaseio.com';
const ADMIN_EMAIL = 'admin@gmail.com';
const EMAIL_SETTINGS_PROPERTY = 'NPFOOD_EMAIL_SETTINGS';

function doPost(event) {
  try {
    const payload = JSON.parse(event.parameter.payload || '{}');
    let result;

    if (payload.action === 'configure') {
      result = configureEmail_(payload);
    } else if (payload.action === 'test') {
      result = sendTestEmail_(payload);
    } else if (payload.action === 'order') {
      result = sendOrderEmail_(payload);
    } else if (payload.action === 'chat') {
      result = sendChatEmail_(payload);
    } else {
      throw new Error('Unsupported action.');
    }

    return jsonResponse_({ ok: true, result: result });
  } catch (error) {
    console.error('Apps Script email request failed: ' + error.name);
    return jsonResponse_({ ok: false, error: 'Request failed. Check Apps Script executions.' });
  }
}

function configureEmail_(payload) {
  const user = verifyFirebaseUser_(payload.idToken);
  if (user.email !== ADMIN_EMAIL) throw new Error('Administrator access required.');

  const input = payload.settings || {};
  const recipientEmail = String(input.recipientEmail || '').trim();
  const enabled = input.enabled === true;
  if (enabled && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
    throw new Error('A valid recipient email is required.');
  }

  const settings = {
    enabled: enabled,
    recipientEmail: recipientEmail,
    orders: input.orders !== false,
    chatMessages: input.chatMessages !== false
  };
  PropertiesService.getScriptProperties()
    .setProperty(EMAIL_SETTINGS_PROPERTY, JSON.stringify(settings));
  return 'Email settings saved.';
}

function sendTestEmail_(payload) {
  const user = verifyFirebaseUser_(payload.idToken);
  if (user.email !== ADMIN_EMAIL) throw new Error('Administrator access required.');

  const settings = loadEmailSettings_();
  if (!settings.recipientEmail) throw new Error('Save a recipient email before testing.');
  MailApp.sendEmail(
    settings.recipientEmail,
    'NP Food - Email test',
    'Email notifications are connected to your Google Apps Script account.'
  );
  return 'Test email sent.';
}

function sendOrderEmail_(payload) {
  const settings = loadEmailSettings_();
  if (!settings.enabled || !settings.orders) return 'Order email notifications are disabled.';
  if (!settings.recipientEmail) throw new Error('The recipient email has not been configured.');

  const orderId = String(payload.orderId || '');
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(orderId)) throw new Error('Invalid order ID.');

  const user = verifyFirebaseUser_(payload.idToken);
  const cache = CacheService.getScriptCache();
  const cacheKey = 'npfood-order-email-' + orderId;
  if (cache.get(cacheKey)) return 'Order email already sent.';

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Could not acquire the email lock.');
  try {
    if (cache.get(cacheKey)) return 'Order email already sent.';

    const order = loadCustomerOrder_(orderId, payload.idToken);
    if (!order || order.customerUid !== user.localId) {
      throw new Error('The order does not belong to the authenticated customer.');
    }

    const subject = 'NP Food - Đơn hàng mới ' + String(order.orderNumber || orderId);
    MailApp.sendEmail(settings.recipientEmail, subject, formatOrderEmail_(order));
    cache.put(cacheKey, 'sent', 21600);
    return 'Order email sent.';
  } finally {
    lock.releaseLock();
  }
}

function sendChatEmail_(payload) {
  const settings = loadEmailSettings_();
  if (!settings.enabled || !settings.chatMessages) return 'Chat email notifications are disabled.';
  if (!settings.recipientEmail) throw new Error('The recipient email has not been configured.');

  const customerUid = String(payload.customerUid || '');
  const messageId = String(payload.messageId || '');
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(customerUid) || !/^[A-Za-z0-9_-]{1,128}$/.test(messageId)) {
    throw new Error('Invalid chat message ID.');
  }

  const user = verifyFirebaseUser_(payload.idToken);
  if (customerUid !== user.localId) throw new Error('The chat does not belong to the authenticated customer.');

  const cache = CacheService.getScriptCache();
  const cacheKey = 'npfood-chat-email-' + customerUid + '-' + messageId;
  if (cache.get(cacheKey)) return 'Chat email already sent.';

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Could not acquire the email lock.');
  try {
    if (cache.get(cacheKey)) return 'Chat email already sent.';

    let senderName = String(payload.senderName || payload.email || '').trim();
    let text = String(payload.text || '').trim();
    let email = String(payload.email || '').trim();
    let productName = String(payload.productName || '').trim();

    if (!text || !senderName) {
      const message = loadCustomerChatMessage_(customerUid, messageId, payload.idToken);
      if (!message || message.sender !== 'customer') return 'Only customer chat messages are notified.';
      senderName = String(message.senderName || message.email || 'Khách hàng');
      text = String(message.text || '');
      email = String(message.email || '');
      productName = message.product && message.product.name
        ? String(message.product.name)
        : '';
    }

    senderName = senderName || 'Khách hàng';
    text = text || 'Khách hàng đã gửi tin nhắn chat.';
    const subject = 'NP Food - Tin nhắn chat mới từ ' + senderName;
    const body = [
      'Bạn có tin nhắn chat mới từ ' + senderName + '.',
      email ? 'Email: ' + email : '',
      text ? 'Nội dung: ' + text : '',
      productName ? 'Sản phẩm: ' + productName : '',
      '',
      'Vui lòng mở trang quản trị NP FOOD để xem và trả lời cuộc trò chuyện.'
    ].filter(function(line) { return line !== ''; }).join('\n');

    MailApp.sendEmail(settings.recipientEmail, subject, body);
    cache.put(cacheKey, 'sent', 21600);
    return 'Chat email sent.';
  } finally {
    lock.releaseLock();
  }
}

function loadEmailSettings_() {
  const value = PropertiesService.getScriptProperties().getProperty(EMAIL_SETTINGS_PROPERTY);
  if (!value) return {
    enabled: false,
    recipientEmail: '',
    orders: true,
    chatMessages: true
  };
  const settings = JSON.parse(value);
  settings.orders = settings.orders !== false;
  settings.chatMessages = settings.chatMessages !== false;
  return settings;
}

function verifyFirebaseUser_(idToken) {
  if (typeof idToken !== 'string' || !idToken) throw new Error('Firebase sign-in is required.');

  const response = UrlFetchApp.fetch(
    'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(FIREBASE_API_KEY),
    {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ idToken: idToken }),
      muteHttpExceptions: true
    }
  );
  if (response.getResponseCode() !== 200) throw new Error('Firebase sign-in token is invalid or expired.');

  const result = JSON.parse(response.getContentText());
  const user = result.users && result.users[0];
  if (!user || !user.localId) throw new Error('Could not verify the Firebase user.');
  return user;
}

function loadCustomerOrder_(orderId, idToken) {
  const url = FIREBASE_DATABASE_URL + '/orders/' + encodeURIComponent(orderId) +
    '.json?auth=' + encodeURIComponent(idToken);
  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) throw new Error('Could not read the order from Firebase.');
  return JSON.parse(response.getContentText());
}

function loadCustomerChatMessage_(customerUid, messageId, idToken) {
  const url = FIREBASE_DATABASE_URL + '/customerChats/' + encodeURIComponent(customerUid) +
    '/messages/' + encodeURIComponent(messageId) + '.json?auth=' + encodeURIComponent(idToken);
  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) throw new Error('Could not read the chat message from Firebase.');
  return JSON.parse(response.getContentText());
}

function formatOrderEmail_(order) {
  const customer = order.customer || {};
  const items = Array.isArray(order.items) ? order.items : [];
  const itemLines = items.map(function(item) {
    return '- ' + String(item.name || 'Sản phẩm') +
      ' x ' + String(item.quantity || 0) +
      ' - ' + formatMoney_(item.price * item.quantity) + 'đ';
  });

  return [
    'Có đơn hàng mới trên NP Food.',
    '',
    'Mã đơn: ' + String(order.orderNumber || ''),
    'Khách hàng: ' + String(customer.name || ''),
    'Điện thoại: ' + String(customer.phone || ''),
    'Email: ' + String(customer.email || ''),
    'Địa chỉ: ' + String(customer.address || ''),
    'Hình thức nhận: ' + String(order.deliveryMethod || ''),
    '',
    'Sản phẩm:',
    itemLines.join('\n') || '- Không có thông tin sản phẩm',
    '',
    'Tổng tiền: ' + formatMoney_(order.totalAmount) + 'đ',
    'Ghi chú: ' + String(order.note || '')
  ].join('\n');
}

function formatMoney_(amount) {
  const value = Number(amount);
  return Number.isFinite(value) ? value.toLocaleString('vi-VN') : '0';
}

function jsonResponse_(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
