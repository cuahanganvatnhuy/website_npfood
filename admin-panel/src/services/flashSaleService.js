import { get, push, ref, remove, set, update } from 'firebase/database';
import { db } from './firebase.js';

const flashSalesRef = ref(db, 'flashSales');

export const getAllFlashSales = async () => {
  try {
    const snapshot = await get(flashSalesRef);
    if (!snapshot.exists()) return [];
    return Object.entries(snapshot.val())
      .map(([id, campaign]) => ({ ...campaign, id }))
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  } catch (error) {
    console.error('Lỗi khi tải Flash Sale:', error);
    throw error;
  }
};

const validateCampaign = (campaign) => {
  const name = String(campaign.name || '').trim();
  const startsAt = new Date(campaign.startsAt);
  const endsAt = new Date(campaign.endsAt);
  const productIds = [...new Set(campaign.productIds || [])].filter(Boolean);

  if (!name) throw new Error('Vui lòng nhập tên chương trình.');
  if (productIds.length === 0) throw new Error('Vui lòng chọn ít nhất một sản phẩm.');
  if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime())) {
    throw new Error('Vui lòng chọn thời gian bắt đầu và kết thúc hợp lệ.');
  }
  if (startsAt >= endsAt) throw new Error('Thời gian kết thúc phải sau thời gian bắt đầu.');

  return {
    name,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    selectedProductIds: Object.fromEntries(productIds.map((productId) => [productId, true]))
  };
};

export const saveFlashSaleDraft = async (campaignId, campaign) => {
  const data = validateCampaign(campaign);
  const now = new Date().toISOString();
  try {
    if (campaignId) {
      await update(ref(db, `flashSales/${campaignId}`), {
        ...data,
        status: 'draft',
        isActive: false,
        updatedAt: now
      });
      return campaignId;
    }

    const newCampaignRef = push(flashSalesRef);
    await set(newCampaignRef, {
      ...data,
      status: 'draft',
      isActive: false,
      createdAt: now,
      updatedAt: now
    });
    return newCampaignRef.key;
  } catch (error) {
    console.error('Lỗi khi lưu bản nháp Flash Sale:', error);
    throw error;
  }
};

export const publishFlashSale = async (campaignId, products) => {
  if (!campaignId) throw new Error('Không tìm thấy chương trình Flash Sale.');
  if (!products || Object.keys(products).length === 0) {
    throw new Error('Chương trình cần có ít nhất một sản phẩm.');
  }
  for (const product of Object.values(products)) {
    const salePrice = Number(product.salePrice);
    if (!Number.isFinite(salePrice) || salePrice <= 0) {
      throw new Error('Giá Flash Sale của sản phẩm phải lớn hơn 0.');
    }
  }

  const now = new Date().toISOString();
  try {
    await update(ref(db, `flashSales/${campaignId}`), {
      products,
      status: 'published',
      isActive: true,
      publishedAt: now,
      updatedAt: now
    });
  } catch (error) {
    console.error('Lỗi khi đăng chương trình Flash Sale:', error);
    throw error;
  }
};

export const setFlashSaleActive = async (campaignId, isActive) => {
  try {
    await update(ref(db, `flashSales/${campaignId}`), {
      isActive: Boolean(isActive),
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật trạng thái Flash Sale:', error);
    throw error;
  }
};

export const deleteFlashSale = async (campaignId) => {
  try {
    await remove(ref(db, `flashSales/${campaignId}`));
  } catch (error) {
    console.error('Lỗi khi xóa chương trình Flash Sale:', error);
    throw error;
  }
};
