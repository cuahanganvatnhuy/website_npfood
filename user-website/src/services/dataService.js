import { auth, db } from './firebase';
import {
  equalTo,
  get,
  orderByChild,
  push,
  query,
  ref,
  runTransaction,
  set,
  update
} from 'firebase/database';

const readCollection = async (path) => {
  const snapshot = await get(ref(db, path));
  if (!snapshot.exists()) return [];

  const items = [];
  snapshot.forEach((childSnapshot) => {
    items.push({ id: childSnapshot.key, ...childSnapshot.val() });
  });
  return items;
};

export const getPaymentSettings = async () => {
  const snapshot = await get(ref(db, 'paymentSettings'));
  const settings = snapshot.exists() ? snapshot.val() : {};
  const qrImageUrl = typeof settings.qrImageUrl === 'string' ? settings.qrImageUrl : '';
  return {
    enabled: settings.enabled === true && Boolean(qrImageUrl),
    qrImageUrl
  };
};

const requestAppsScriptOrderEmail = async (orderId, customerUid) => {
  const user = auth.currentUser;
  if (!user || user.uid !== customerUid) return;

  const webhookSnapshot = await get(ref(db, 'publicConfig/emailNotificationWebhookUrl'));
  const webhookUrl = webhookSnapshot.val();
  if (!webhookUrl) return;

  let endpoint;
  try {
    endpoint = new URL(webhookUrl);
  } catch {
    throw new Error('URL Apps Script nhận thông báo đơn hàng không hợp lệ.');
  }
  if (
    endpoint.protocol !== 'https:' ||
    endpoint.hostname !== 'script.google.com' ||
    !/^\/macros\/s\/[^/]+\/exec\/?$/.test(endpoint.pathname)
  ) {
    throw new Error('URL Apps Script nhận thông báo đơn hàng không hợp lệ.');
  }

  const idToken = await user.getIdToken();
  await fetch(endpoint.toString(), {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: new URLSearchParams({
      payload: JSON.stringify({ action: 'order', idToken, orderId })
    })
  });
};

export const getProductImages = async () => {
  try {
    const products = await readCollection('products');
    return products.reduce((images, product) => {
      const imageUrl = (Array.isArray(product.imageUrls) && product.imageUrls[0]) ||
        product.imageUrl || product.image || '';
      if (imageUrl) images[product.id] = imageUrl;
      return images;
    }, {});
  } catch (error) {
    console.error('Error fetching product images:', error);
    throw error;
  }
};

export const getActiveBanners = async () => {
  try {
    const banners = await readCollection('banners');
    return banners
      .filter((banner) => banner.isActive !== false)
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  } catch (error) {
    console.error('Error fetching banners:', error);
    throw error;
  }
};

export const getActiveMarketplaceChannels = async () => {
  try {
    const channels = await readCollection('marketplaceChannels');
    return channels
      .filter((channel) => {
        if (channel.isActive === false || !channel.name || !channel.url) return false;
        try {
          const url = new URL(channel.url);
          return url.protocol === 'https:' || url.protocol === 'http:';
        } catch {
          return false;
        }
      })
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  } catch (error) {
    console.error('Error fetching marketplace channels:', error);
    throw error;
  }
};

export const getActiveProducts = async () => {
  try {
    const [products, campaigns] = await Promise.all([
      readCollection('products'),
      readCollection('flashSales')
    ]);
    const now = Date.now();
    const activeCampaigns = campaigns.filter((campaign) => {
      if (campaign.status !== 'published' || campaign.isActive !== true) return false;
      const startsAt = new Date(campaign.startsAt).getTime();
      const endsAt = new Date(campaign.endsAt).getTime();
      return Number.isFinite(startsAt) && Number.isFinite(endsAt) && startsAt <= now && now < endsAt;
    });
    const saleByProductId = {};

    activeCampaigns.forEach((campaign) => {
      Object.entries(campaign.products || {}).forEach(([productId, sale]) => {
        const salePrice = Number(sale.salePrice);
        const product = products.find((item) => item.id === productId);
        if (!product || product.isActive === false ||
            !Number.isFinite(salePrice) ||
            salePrice <= 0 ||
            salePrice >= Number(product.price)) return;
        const currentSale = saleByProductId[productId];
        if (!currentSale || salePrice < currentSale.salePrice) {
          saleByProductId[productId] = {
            salePrice,
            campaignId: campaign.id,
            name: campaign.name || 'Flash Sale',
            endsAt: campaign.endsAt
          };
        }
      });
    });

    return products
      .filter((product) => product.isActive !== false)
      .map((product) => {
        const sale = saleByProductId[product.id];
        if (!sale) return product;
        return {
          ...product,
          originalPrice: Number(product.price),
          price: sale.salePrice,
          flashSale: {
            campaignId: sale.campaignId,
            name: sale.name,
            endsAt: sale.endsAt
          }
        };
      })
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  } catch (error) {
    console.error('Error fetching products and Flash Sale prices:', error);
    throw error;
  }
};

export const getAvailableVouchers = async () => {
  try {
    const vouchers = await readCollection('vouchers');
    const now = Date.now();
    return vouchers
      .filter((voucher) => {
        if (voucher.isActive === false) return false;
        const startsAt = voucher.startsAt ? new Date(voucher.startsAt).getTime() : 0;
        const expiresAt = voucher.expiresAt ? new Date(voucher.expiresAt).getTime() : Infinity;
        const usageLimit = Number(voucher.usageLimit) || 0;
        const usedCount = Number(voucher.usedCount) || 0;
        return Number.isFinite(startsAt) &&
          (Number.isFinite(expiresAt) || expiresAt === Infinity) &&
          startsAt <= now &&
          now < expiresAt &&
          (usageLimit === 0 || usedCount < usageLimit);
      })
      .sort((a, b) => {
        const aExpiry = a.expiresAt ? new Date(a.expiresAt).getTime() : Infinity;
        const bExpiry = b.expiresAt ? new Date(b.expiresAt).getTime() : Infinity;
        return aExpiry - bExpiry;
      });
  } catch (error) {
    console.error('Error fetching available vouchers:', error);
    throw error;
  }
};

const isVoucherCurrentlyAvailable = (voucher, now = Date.now()) => {
  if (!voucher || voucher.isActive === false) return false;
  const startsAt = voucher.startsAt ? new Date(voucher.startsAt).getTime() : 0;
  const expiresAt = voucher.expiresAt ? new Date(voucher.expiresAt).getTime() : Infinity;
  const usageLimit = Number(voucher.usageLimit) || 0;
  const usedCount = Number(voucher.usedCount) || 0;
  return Number.isFinite(startsAt) &&
    (Number.isFinite(expiresAt) || expiresAt === Infinity) &&
    startsAt <= now &&
    now < expiresAt &&
    (usageLimit === 0 || usedCount < usageLimit);
};

export const getCustomerVoucherClaims = async (customerUid) => {
  if (!customerUid) throw new Error('Vui lòng đăng nhập để xem kho voucher.');
  try {
    return await readCollection(`customerVouchers/${customerUid}`);
  } catch (error) {
    console.error('Error fetching customer voucher claims:', error);
    throw error;
  }
};

export const claimCustomerVoucher = async (customerUid, voucherId) => {
  if (!customerUid || !voucherId) throw new Error('Không xác định được tài khoản hoặc voucher.');
  try {
    const [voucherSnapshot, profileSnapshot] = await Promise.all([
      get(ref(db, `vouchers/${voucherId}`)),
      get(ref(db, `customers/${customerUid}`))
    ]);
    if (!voucherSnapshot.exists()) throw new Error('Voucher này không còn tồn tại.');

    const voucher = voucherSnapshot.val();
    if (!isVoucherCurrentlyAvailable(voucher)) {
      throw new Error('Voucher này đã hết hạn hoặc không còn khả dụng.');
    }
    const profile = profileSnapshot.exists() ? profileSnapshot.val() : {};
    if (voucher.audienceType === 'tier' && voucher.targetTier !== profile.tier) {
      throw new Error(`Voucher chỉ dành cho thành viên hạng ${voucher.targetTier}.`);
    }

    const claim = {
      voucherId,
      code: voucher.code,
      name: voucher.name || 'Ưu đãi NP Food',
      discountType: voucher.discountType,
      discountValue: Number(voucher.discountValue) || 0,
      audienceType: voucher.audienceType || 'all',
      targetTier: voucher.targetTier || '',
      minOrder: Number(voucher.minOrder) || 0,
      startsAt: voucher.startsAt || '',
      expiresAt: voucher.expiresAt || '',
      claimedAt: new Date().toISOString(),
      status: 'available'
    };
    let alreadyClaimed = false;
    const result = await runTransaction(
      ref(db, `customerVouchers/${customerUid}/${voucherId}`),
      (existingClaim) => {
        if (existingClaim) {
          alreadyClaimed = true;
          return;
        }
        return claim;
      }
    );
    if (alreadyClaimed || !result.committed) {
      throw new Error('Bạn đã lấy voucher này rồi.');
    }
    return result.snapshot.val();
  } catch (error) {
    console.error('Error claiming voucher:', error);
    throw error;
  }
};

export const calculateVoucherDiscount = (voucher, subtotal) => {
  const orderSubtotal = Math.max(0, Number(subtotal) || 0);
  if (!voucher || orderSubtotal < (Number(voucher.minOrder) || 0)) return 0;
  const value = Number(voucher.discountValue) || 0;
  const discount = voucher.discountType === 'percent'
    ? orderSubtotal * value / 100
    : value;
  return Math.max(0, Math.min(orderSubtotal, Math.round(discount)));
};

export const getAllCategories = async () => {
  try {
    const categories = await readCollection('categories');
    return categories.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  } catch (error) {
    console.error('Error fetching categories:', error);
    throw error;
  }
};

export const getIntroduction = async () => {
  try {
    const introductions = await readCollection('introduction');
    return introductions.reduce((latest, introduction) => {
      if (!latest) return introduction;
      return new Date(introduction.updatedAt || introduction.createdAt || 0) >
        new Date(latest.updatedAt || latest.createdAt || 0) ? introduction : latest;
    }, null);
  } catch (error) {
    console.error('Error fetching introduction:', error);
    throw error;
  }
};

export const getPublishedNews = async () => {
  try {
    const news = await readCollection('news');
    return news
      .filter((item) => item.published === true)
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  } catch (error) {
    console.error('Error fetching news:', error);
    throw error;
  }
};

export const getNewsById = async (newsId) => {
  try {
    const snapshot = await get(ref(db, `news/${newsId}`));
    if (!snapshot.exists()) return null;
    return { id: snapshot.key, ...snapshot.val() };
  } catch (error) {
    console.error('Error fetching news:', error);
    throw error;
  }
};

export const getContactInfo = async () => {
  try {
    const contacts = await readCollection('contact');
    return contacts.reduce((latest, contact) => {
      if (!latest) return contact;
      return new Date(contact.updatedAt || contact.createdAt || 0) >
        new Date(latest.updatedAt || latest.createdAt || 0) ? contact : latest;
    }, null);
  } catch (error) {
    console.error('Error fetching contact info:', error);
    throw error;
  }
};

export const createContactMessage = async (messageData) => {
  try {
    const messageRef = push(ref(db, 'contactMessages'));
    await set(messageRef, {
      ...messageData,
      createdAt: new Date().toISOString(),
      read: false
    });
    return messageRef.key;
  } catch (error) {
    console.error('Error creating contact message:', error);
    throw error;
  }
};

export const getCustomerOrders = async (customerUid) => {
  if (!customerUid) throw new Error('Vui lòng đăng nhập để xem đơn hàng.');

  try {
    const ordersQuery = query(
      ref(db, 'orders'),
      orderByChild('customerUid'),
      equalTo(customerUid)
    );
    const snapshot = await get(ordersQuery);
    if (!snapshot.exists()) return [];

    const orders = [];
    snapshot.forEach((childSnapshot) => {
      const order = childSnapshot.val();
      if (order?.customerUid === customerUid) {
        orders.push({ id: childSnapshot.key, ...order });
      }
    });
    orders.sort((a, b) => {
      const dateA = new Date(a.createdAt || a.orderDate || 0).getTime();
      const dateB = new Date(b.createdAt || b.orderDate || 0).getTime();
      return (Number.isFinite(dateB) ? dateB : 0) - (Number.isFinite(dateA) ? dateA : 0);
    });
    return orders;
  } catch (error) {
    console.error('Error fetching customer orders:', error);
    throw error;
  }
};

export const createOrder = async ({
  customerUid,
  customer,
  items,
  totalAmount,
  subtotalAmount = totalAmount,
  discountAmount = 0,
  voucherDiscountAmount = discountAmount,
  pointsToRedeem = 0,
  deliveryMethod = 'delivery',
  deliveryLocation = null,
  paymentMethod = 'cash_on_delivery',
  voucherId = '',
  note,
  orderNumber: requestedOrderNumber = '',
  expectedMomoQrImageUrl = ''
}) => {
  try {
    if (!customerUid) throw new Error('Vui lòng đăng nhập để đặt hàng.');
    if (!['delivery', 'pickup'].includes(deliveryMethod)) {
      throw new Error('Hình thức nhận hàng không hợp lệ.');
    }
    if (!['cash_on_delivery', 'momo'].includes(paymentMethod)) {
      throw new Error('Phương thức thanh toán không hợp lệ.');
    }
    let momoQrImageUrl = '';
    if (paymentMethod === 'momo') {
      const paymentSettings = await getPaymentSettings();
      if (!paymentSettings.enabled) {
        throw new Error('Thanh toán MoMo hiện không khả dụng. Vui lòng chọn thanh toán khi nhận hàng.');
      }
      if (expectedMomoQrImageUrl && paymentSettings.qrImageUrl !== expectedMomoQrImageUrl) {
        throw new Error('Mã QR thanh toán vừa thay đổi. Vui lòng quay lại giỏ hàng và tạo yêu cầu thanh toán mới.');
      }
      if (!String(customer?.phone || '').trim()) {
        throw new Error('Vui lòng nhập số điện thoại để tạo nội dung chuyển khoản MoMo.');
      }
      momoQrImageUrl = paymentSettings.qrImageUrl;
    }
    let orderDeliveryLocation = null;
    if (deliveryLocation) {
      const latitude = Number(deliveryLocation.latitude);
      const longitude = Number(deliveryLocation.longitude);
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
          !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
        throw new Error('Vị trí giao hàng không hợp lệ.');
      }
      orderDeliveryLocation = { latitude, longitude };
    }
    const orderSubtotal = Number(subtotalAmount);
    const orderTotal = Number(totalAmount);
    const totalDiscount = Number(discountAmount);
    const voucherDiscount = Number(voucherDiscountAmount);
    const redeemedPoints = Number(pointsToRedeem);
    if (![orderSubtotal, orderTotal, totalDiscount, voucherDiscount, redeemedPoints].every(Number.isFinite) ||
        orderSubtotal < 0 ||
        orderTotal < 0 ||
        totalDiscount < 0 ||
        voucherDiscount < 0 ||
        !Number.isInteger(redeemedPoints) ||
        redeemedPoints < 0 ||
        totalDiscount !== voucherDiscount + redeemedPoints ||
        Math.abs(orderTotal - (orderSubtotal - totalDiscount)) > 1 ||
        (!voucherId && voucherDiscount > 0)) {
      throw new Error('Thông tin giảm giá hoặc tổng tiền đơn hàng không hợp lệ.');
    }

    const orderRef = push(ref(db, 'orders'));
    if (!orderRef.key) throw new Error('Không thể tạo mã đơn hàng. Vui lòng thử lại.');
    const now = new Date().toISOString();
    const orderNumber = requestedOrderNumber || `NP-${Date.now().toString().slice(-8)}`;
    if (!/^NP-\d{8}$/.test(orderNumber)) {
      throw new Error('Mã đơn hàng không hợp lệ.');
    }
    const paymentReference = paymentMethod === 'momo'
      ? `${orderNumber} ${String(customer.phone).trim()}`
      : '';
    const orderData = {
      orderNumber,
      customerUid,
      customer,
      deliveryMethod,
      deliveryLocation: deliveryMethod === 'delivery' ? orderDeliveryLocation : null,
      items: items.map((item) => ({
        productId: item.productId,
        name: item.name,
        price: Number(item.price),
        quantity: Number(item.quantity),
        imageUrl: item.imageUrl || ''
      })),
      totalAmount: orderTotal,
      subtotalAmount: orderSubtotal,
      discountAmount: totalDiscount,
      voucherDiscountAmount: voucherDiscount,
      pointsRedeemed: redeemedPoints,
      pointsDiscountAmount: redeemedPoints,
      paymentMethod,
      ...(paymentMethod === 'momo'
        ? { paymentStatus: 'pending', paymentReference }
        : {}),
      note: note || '',
      status: 'pending',
      createdAt: now,
      updatedAt: now
    };

    const needsCustomerProfile = Boolean(voucherId) || redeemedPoints > 0;
    const [claimSnapshot, voucherSnapshot, profileSnapshot] = await Promise.all([
      voucherId
        ? get(ref(db, `customerVouchers/${customerUid}/${voucherId}`))
        : Promise.resolve(null),
      voucherId
        ? get(ref(db, `vouchers/${voucherId}`))
        : Promise.resolve(null),
      needsCustomerProfile
        ? get(ref(db, `customers/${customerUid}`))
        : Promise.resolve(null)
    ]);

    const profile = profileSnapshot?.exists() ? profileSnapshot.val() : {};
    if (redeemedPoints > Math.max(0, Math.floor(Number(profile.points) || 0))) {
      throw new Error('Số điểm của bạn vừa thay đổi. Vui lòng tải lại giỏ hàng.');
    }

    const updates = {
      [`orders/${orderRef.key}`]: orderData
    };

    if (voucherId) {
      if (!claimSnapshot.exists() || !voucherSnapshot.exists()) {
        throw new Error('Voucher không còn trong kho hoặc đã bị gỡ.');
      }

      const claim = claimSnapshot.val();
      const voucher = voucherSnapshot.val();
      if (claim.status !== 'available') throw new Error('Voucher này đã được sử dụng.');
      if (!isVoucherCurrentlyAvailable(voucher)) {
        throw new Error('Voucher này đã hết hạn hoặc hết lượt sử dụng.');
      }
      if (voucher.code !== claim.code ||
          voucher.discountType !== claim.discountType ||
          Number(voucher.discountValue) !== Number(claim.discountValue)) {
        throw new Error('Điều kiện voucher đã thay đổi. Vui lòng kiểm tra lại kho voucher.');
      }
      if (voucher.audienceType === 'tier' && voucher.targetTier !== profile.tier) {
        throw new Error(`Voucher chỉ dành cho thành viên hạng ${voucher.targetTier}.`);
      }

      const calculatedDiscount = calculateVoucherDiscount(claim, orderSubtotal);
      if (calculatedDiscount <= 0 ||
          calculatedDiscount !== voucherDiscount) {
        throw new Error('Voucher không đủ điều kiện cho đơn hàng này. Vui lòng kiểm tra lại tổng tiền.');
      }

      const redeemedClaim = {
        ...claim,
        status: 'redeemed',
        redeemedAt: now,
        orderId: orderRef.key
      };
      orderData.voucherId = voucherId;
      orderData.voucherCode = claim.code;
      orderData.voucherName = claim.name;
      updates[`customerVouchers/${customerUid}/${voucherId}`] = redeemedClaim;
    }

    if (redeemedPoints > 0) {
      updates[`customers/${customerUid}/points`] =
        Math.max(0, Math.floor(Number(profile.points) || 0)) - redeemedPoints;
    }

    if (voucherId || redeemedPoints > 0) {
      await update(ref(db), updates);
    } else {
      await set(orderRef, orderData);
    }

    try {
      await requestAppsScriptOrderEmail(orderRef.key, customerUid);
    } catch (notificationError) {
      console.error('Đơn hàng đã được tạo nhưng không thể gọi Apps Script gửi Gmail:', notificationError);
    }

    return {
      id: orderRef.key,
      orderNumber,
      paymentMethod,
      totalAmount: orderTotal,
      paymentReference,
      qrImageUrl: momoQrImageUrl
    };
  } catch (error) {
    console.error('Error creating order:', error);
    throw error;
  }
};
