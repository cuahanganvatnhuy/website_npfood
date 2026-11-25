import { get, ref, set } from 'firebase/database';
import { db } from './firebase.js';

const PAYMENT_SETTINGS_PATH = 'paymentSettings';
const MAX_QR_IMAGE_DATA_URL_LENGTH = Math.ceil(1024 * 1024 * 4 / 3) + 128;
const imageDataUrlPattern = /^data:image\/(?:png|jpeg|webp);base64,/i;

export const defaultPaymentSettings = {
  enabled: false,
  qrImageUrl: ''
};

export const loadPaymentSettings = async () => {
  const snapshot = await get(ref(db, PAYMENT_SETTINGS_PATH));
  const settings = snapshot.exists() ? snapshot.val() : {};
  const qrImageUrl = typeof settings.qrImageUrl === 'string' ? settings.qrImageUrl : '';
  return {
    enabled: settings.enabled === true && Boolean(qrImageUrl),
    qrImageUrl
  };
};

export const savePaymentSettings = async (settings) => {
  const enabled = Boolean(settings.enabled);
  const qrImageUrl = typeof settings.qrImageUrl === 'string' ? settings.qrImageUrl : '';

  if (qrImageUrl && !imageDataUrlPattern.test(qrImageUrl)) {
    throw new Error('Ảnh QR không hợp lệ. Hãy tải ảnh PNG, JPG hoặc WebP.');
  }
  if (qrImageUrl.length > MAX_QR_IMAGE_DATA_URL_LENGTH) {
    throw new Error('Ảnh QR cần có dung lượng tối đa 1 MB.');
  }
  if (enabled && !qrImageUrl) {
    throw new Error('Hãy tải ảnh QR MoMo lên trước khi bật thanh toán MoMo.');
  }

  const savedSettings = {
    enabled,
    qrImageUrl,
    updatedAt: new Date().toISOString()
  };
  await set(ref(db, PAYMENT_SETTINGS_PATH), savedSettings);
  return savedSettings;
};
