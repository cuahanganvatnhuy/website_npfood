import { onValue, push, ref, set } from 'firebase/database';
import { db } from './firebase';

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
  return messageRef.key;
};
