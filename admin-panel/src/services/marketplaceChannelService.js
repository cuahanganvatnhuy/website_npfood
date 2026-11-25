import { get, push, ref, remove, set, update } from 'firebase/database';
import { db } from './firebase.js';

const channelsRef = ref(db, 'marketplaceChannels');

export const getAllMarketplaceChannels = async () => {
  try {
    const snapshot = await get(channelsRef);
    if (!snapshot.exists()) return [];

    const channels = [];
    snapshot.forEach((childSnapshot) => {
      channels.push({ id: childSnapshot.key, ...childSnapshot.val() });
    });
    return channels.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  } catch (error) {
    console.error('Lỗi khi tải kênh thương mại điện tử:', error);
    throw error;
  }
};

export const createMarketplaceChannel = async (channelData) => {
  try {
    const channelRef = push(channelsRef);
    const now = new Date().toISOString();
    await set(channelRef, {
      ...channelData,
      createdAt: now,
      updatedAt: now
    });
    return channelRef.key;
  } catch (error) {
    console.error('Lỗi khi thêm kênh thương mại điện tử:', error);
    throw error;
  }
};

export const updateMarketplaceChannel = async (channelId, channelData) => {
  try {
    await update(ref(db, `marketplaceChannels/${channelId}`), {
      ...channelData,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật kênh thương mại điện tử:', error);
    throw error;
  }
};

export const deleteMarketplaceChannel = async (channelId) => {
  try {
    await remove(ref(db, `marketplaceChannels/${channelId}`));
  } catch (error) {
    console.error('Lỗi khi xóa kênh thương mại điện tử:', error);
    throw error;
  }
};
