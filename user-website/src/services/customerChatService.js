import { get, onValue, push, ref, set } from 'firebase/database';
import { auth, db } from './firebase';

const requestAppsScriptChatEmail = async (customerUid, messageId, message) => {
  const user = auth?.currentUser;
  if (!user || user.uid !== customerUid) return;

  const webhookSnapshot = await get(ref(db, 'publicConfig/emailNotificationWebhookUrl'));
  const webhookUrl = webhookSnapshot.val();
  if (!webhookUrl) return;

  let endpoint;
  try {
    endpoint = new URL(webhookUrl);
  } catch {
    return;
  }
  if (
    endpoint.protocol !== 'https:' ||
    endpoint.hostname !== 'script.google.com' ||
    !/^\/macros\/s\/[^/]+\/exec\/?$/.test(endpoint.pathname)
  ) return;

  const idToken = await user.getIdToken();
  await fetch(endpoint.toString(), {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: new URLSearchParams({
      payload: JSON.stringify({
        action: 'chat',
        idToken,
        customerUid,
        messageId,
        senderName: message.senderName,
        email: message.email,
        text: message.text,
        productName: message.product?.name || ''
      })
    })
  });
};

export const subscribeToCustomerChat = (customerUid, onMessages, onError) => {
  if (!customerUid) throw new Error('Vui lòng đăng nhập để xem tin nhắn.');

  return onValue(
    ref(db, `customerChats/${customerUid}/messages`),
    (snapshot) => {
      const messages = [];
      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          messages.push({ id: childSnapshot.key, ...childSnapshot.val() });
        });
      }
      messages.sort((first, second) => new Date(first.createdAt) - new Date(second.createdAt));
      onMessages(messages);
    },
    onError
  );
};

export const sendCustomerChatMessage = async (customerUid, { text, senderName, email, product }) => {
  const messageText = String(text || (product ? 'Mình muốn hỏi thêm về sản phẩm này.' : '')).trim();
  if (!customerUid) throw new Error('Vui lòng đăng nhập để gửi tin nhắn.');
  if (!messageText) throw new Error('Vui lòng nhập nội dung tin nhắn.');
  if (messageText.length > 2000) throw new Error('Tin nhắn không được vượt quá 2.000 ký tự.');

  const messageRef = push(ref(db, `customerChats/${customerUid}/messages`));
  const message = {
    text: messageText,
    sender: 'customer',
    senderName: String(senderName || 'Khách hàng').slice(0, 120),
    email: String(email || '').slice(0, 254),
    createdAt: new Date().toISOString()
  };
  if (product) {
    message.product = {
      id: String(product.id || ''),
      name: String(product.name || 'Sản phẩm').slice(0, 300),
      imageUrl: String(product.imageUrl || '').slice(0, 2000),
      price: Number(product.price) || 0,
      originalPrice: Number(product.originalPrice ?? product.price) || 0
    };
  }

  await set(messageRef, message);
  try {
    await requestAppsScriptChatEmail(customerUid, messageRef.key, message);
  } catch (error) {
    console.error('Không thể yêu cầu gửi email thông báo chat:', error);
  }
  return messageRef.key;
};
