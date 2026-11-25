jest.mock('./firebase', () => ({ auth: { currentUser: null }, db: {} }));
jest.mock('firebase/database', () => ({
  get: jest.fn(),
  push: jest.fn(),
  ref: jest.fn((database, path) => ({ path })),
  set: jest.fn(),
  update: jest.fn()
}));

import { auth } from './firebase';
import { get, push, ref, set } from 'firebase/database';
import {
  createOrder,
  getActiveProducts,
  getActiveMarketplaceChannels,
  getAvailableVouchers,
  getProductImages
} from './dataService';

let mockCollections;

const makeSnapshot = (collection) => ({
  exists: () => Boolean(collection),
  val: () => collection,
  forEach: (callback) => Object.entries(collection || {}).forEach(([key, value]) => {
    callback({ key, val: () => value });
  })
});

beforeEach(() => {
  jest.clearAllMocks();
  mockCollections = {};
  auth.currentUser = null;
  ref.mockImplementation((database, path) => ({ path }));
  get.mockImplementation(async ({ path }) => makeSnapshot(mockCollections[path]));
});

test('uses the lowest valid price from a currently active published Flash Sale', async () => {
  const now = Date.now();
  mockCollections = {
    products: {
      product1: { name: 'Sản phẩm', price: 100000, isActive: true }
    },
    flashSales: {
      current: {
        name: 'Flash Sale cuối tuần',
        status: 'published',
        isActive: true,
        startsAt: new Date(now - 60_000).toISOString(),
        endsAt: new Date(now + 60_000).toISOString(),
        products: { product1: { salePrice: 75000 } }
      },
      draft: {
        name: 'Bản nháp',
        status: 'draft',
        isActive: false,
        startsAt: new Date(now - 60_000).toISOString(),
        endsAt: new Date(now + 60_000).toISOString(),
        products: { product1: { salePrice: 1000 } }
      }
    }
  };

  const products = await getActiveProducts();

  expect(products[0]).toMatchObject({
    price: 75000,
    originalPrice: 100000,
    flashSale: { name: 'Flash Sale cuối tuần' }
  });
});

test('returns only active vouchers within their dates and usage limits', async () => {
  const now = Date.now();
  mockCollections = {
    vouchers: {
      general: { code: 'ALL10', isActive: true, usageLimit: 0, usedCount: 0 },
      tier: {
        code: 'GOLD20',
        isActive: true,
        audienceType: 'tier',
        targetTier: 'Vàng',
        startsAt: new Date(now - 60_000).toISOString(),
        expiresAt: new Date(now + 60_000).toISOString()
      },
      expired: { code: 'OLD10', isActive: true, expiresAt: new Date(now - 60_000).toISOString() },
      exhausted: { code: 'USED10', isActive: true, usageLimit: 2, usedCount: 2 },
      hidden: { code: 'OFF10', isActive: false }
    }
  };

  const vouchers = await getAvailableVouchers();

  expect(vouchers.map((voucher) => voucher.code).sort()).toEqual(['ALL10', 'GOLD20']);
  expect(vouchers.find((voucher) => voucher.code === 'GOLD20').targetTier).toBe('Vàng');
});

test('returns only visible HTTP marketplace links in display order', async () => {
  mockCollections = {
    marketplaceChannels: {
      later: { name: 'TikTok Shop', url: 'https://example.com/tiktok', order: 2 },
      first: { name: 'Shopee', url: 'https://example.com/shopee', order: 1 },
      hidden: { name: 'Hidden', url: 'https://example.com/hidden', isActive: false },
      unsafe: { name: 'Unsafe', url: 'javascript:alert(1)' }
    }
  };

  const channels = await getActiveMarketplaceChannels();

  expect(channels.map((channel) => channel.name)).toEqual(['Shopee', 'TikTok Shop']);
});

test('loads product thumbnails for displaying older order items', async () => {
  mockCollections = {
    products: {
      product1: { imageUrls: ['https://example.com/product-1.png'] },
      product2: { imageUrl: 'https://example.com/product-2.png' }
    }
  };

  await expect(getProductImages()).resolves.toEqual({
    product1: 'https://example.com/product-1.png',
    product2: 'https://example.com/product-2.png'
  });
});

test('records pickup orders without a delivery address location', async () => {
  push.mockReturnValue({ key: 'order-1' });

  await createOrder({
    customerUid: 'customer-1',
    customer: { name: 'Khách hàng', phone: '0900000000', address: 'Nhận tại cửa hàng' },
    items: [{
      productId: 'product-1',
      name: 'Sản phẩm mẫu',
      price: 100000,
      quantity: 1,
      imageUrl: 'https://example.com/product.png'
    }],
    totalAmount: 100000,
    deliveryMethod: 'pickup'
  });

  expect(set).toHaveBeenCalledWith(
    { key: 'order-1' },
    expect.objectContaining({
      deliveryMethod: 'pickup',
      deliveryLocation: null,
      paymentMethod: 'cash_on_delivery',
      customer: expect.objectContaining({ address: 'Nhận tại cửa hàng' }),
      items: [expect.objectContaining({ imageUrl: 'https://example.com/product.png' })]
    })
  );
});

test('creates MoMo payment instructions using the current QR settings and customer phone', async () => {
  push.mockReturnValue({ key: 'order-momo' });
  mockCollections.paymentSettings = {
    enabled: true,
    qrImageUrl: 'data:image/png;base64,cXItZGF0YQ=='
  };

  const order = await createOrder({
    customerUid: 'customer-1',
    customer: { name: 'Khách hàng', phone: '0900000000', address: 'Địa chỉ' },
    items: [],
    totalAmount: 125000,
    paymentMethod: 'momo'
  });

  expect(set).toHaveBeenCalledWith(
    { key: 'order-momo' },
    expect.objectContaining({
      paymentMethod: 'momo',
      paymentStatus: 'pending',
      paymentReference: expect.stringMatching(/^NP-\d{8} 0900000000$/),
      totalAmount: 125000
    })
  );
  expect(order).toMatchObject({
    paymentMethod: 'momo',
    totalAmount: 125000,
    qrImageUrl: 'data:image/png;base64,cXItZGF0YQ=='
  });
  expect(order.paymentReference).toMatch(/^NP-\d{8} 0900000000$/);
});

test('preserves the MoMo reference prepared before order confirmation', async () => {
  push.mockReturnValue({ key: 'order-momo-confirmed' });
  mockCollections.paymentSettings = {
    enabled: true,
    qrImageUrl: 'data:image/png;base64,cXItZGF0YQ=='
  };

  const order = await createOrder({
    customerUid: 'customer-1',
    customer: { name: 'Khách hàng', phone: '0900000000', address: 'Địa chỉ' },
    items: [],
    totalAmount: 125000,
    paymentMethod: 'momo',
    orderNumber: 'NP-12345678'
  });

  expect(order.orderNumber).toBe('NP-12345678');
  expect(order.paymentReference).toBe('NP-12345678 0900000000');
});

test('rejects MoMo orders when the store has disabled QR payment', async () => {
  await expect(createOrder({
    customerUid: 'customer-1',
    customer: { name: 'Khách hàng', phone: '0900000000', address: 'Địa chỉ' },
    items: [],
    totalAmount: 125000,
    paymentMethod: 'momo'
  })).rejects.toThrow('Thanh toán MoMo hiện không khả dụng');

  expect(push).not.toHaveBeenCalled();
});

test('records the selected GPS location on delivery orders', async () => {
  push.mockReturnValue({ key: 'order-2' });

  await createOrder({
    customerUid: 'customer-1',
    customer: { name: 'Khách hàng', phone: '0900000000', address: 'Địa chỉ giao hàng' },
    items: [],
    totalAmount: 100000,
    deliveryMethod: 'delivery',
    deliveryLocation: { latitude: 10.77, longitude: 106.69 }
  });

  expect(set).toHaveBeenCalledWith(
    { key: 'order-2' },
    expect.objectContaining({
      deliveryMethod: 'delivery',
      deliveryLocation: { latitude: 10.77, longitude: 106.69 }
    })
  );
});

test('requests an Apps Script email after successfully creating an order', async () => {
  push.mockReturnValue({ key: 'order-3' });
  mockCollections['publicConfig/emailNotificationWebhookUrl'] =
    'https://script.google.com/macros/s/deployment-id/exec';
  auth.currentUser = {
    uid: 'customer-1',
    getIdToken: jest.fn().mockResolvedValue('firebase-id-token')
  };
  const originalFetch = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({ type: 'opaque' });

  try {
    await createOrder({
      customerUid: 'customer-1',
      customer: { name: 'Khách hàng', phone: '0900000000', address: 'Địa chỉ' },
      items: [],
      totalAmount: 100000
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://script.google.com/macros/s/deployment-id/exec',
      expect.objectContaining({ method: 'POST', mode: 'no-cors' })
    );
    const body = global.fetch.mock.calls[0][1].body;
    expect(JSON.parse(body.get('payload'))).toMatchObject({
      action: 'order',
      idToken: 'firebase-id-token',
      orderId: 'order-3'
    });
  } finally {
    global.fetch = originalFetch;
  }
});
