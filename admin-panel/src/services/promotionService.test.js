jest.mock('./firebase.js', () => ({ db: {} }));
jest.mock('firebase/database', () => ({
  get: jest.fn(),
  push: jest.fn(),
  remove: jest.fn(),
  ref: jest.fn((database, path) => ({ path })),
  set: jest.fn(),
  update: jest.fn()
}));

import { get, push, ref, remove, set, update } from 'firebase/database';
import {
  deleteVoucher,
  getLoyaltySettings,
  hideVoucher,
  saveLoyaltySettings,
  saveVoucher
} from './promotionService.js';

const baseVoucher = {
  name: 'Ưu đãi thành viên',
  code: 'NPFOOD10',
  discountType: 'percent',
  discountValue: 10,
  minOrder: 0,
  usageLimit: 0,
  isActive: true,
  startsAt: '',
  expiresAt: ''
};

beforeEach(() => {
  jest.clearAllMocks();
  ref.mockImplementation((database, path) => ({ path }));
  get.mockResolvedValue({ exists: () => false, val: () => null });
  push.mockReturnValue({ key: 'voucher-1', path: 'vouchers/voucher-1' });
  set.mockResolvedValue(undefined);
  remove.mockResolvedValue(undefined);
  update.mockResolvedValue(undefined);
});

test('saves a voucher targeted to a selected membership tier', async () => {
  await saveVoucher({
    ...baseVoucher,
    audienceType: 'tier',
    targetTier: 'Vàng'
  });

  expect(set).toHaveBeenCalledWith(
    expect.objectContaining({ path: 'vouchers/voucher-1' }),
    expect.objectContaining({
      audienceType: 'tier',
      targetTier: 'Vàng'
    })
  );
});

test('saves a regular voucher without a tier restriction', async () => {
  await saveVoucher({
    ...baseVoucher,
    audienceType: 'all',
    targetTier: 'Vàng'
  });

  expect(set).toHaveBeenCalledWith(
    expect.objectContaining({ path: 'vouchers/voucher-1' }),
    expect.objectContaining({
      audienceType: 'all',
      targetTier: ''
    })
  );
});

test('hides a voucher without deleting its record', async () => {
  await hideVoucher('voucher-1');

  expect(update).toHaveBeenCalledWith(
    expect.objectContaining({ path: 'vouchers/voucher-1' }),
    expect.objectContaining({ isActive: false })
  );
  expect(remove).not.toHaveBeenCalled();
});

test('permanently deletes a voucher record', async () => {
  await deleteVoucher('voucher-1');

  expect(remove).toHaveBeenCalledWith(expect.objectContaining({ path: 'vouchers/voucher-1' }));
});

test('defaults to 1,000 VND per point and the four fixed tiers', async () => {
  await expect(getLoyaltySettings()).resolves.toMatchObject({
    amountPerPoint: 1000,
    pointsPerAmount: 1,
    tiers: [
      { name: 'Đồng', minPoints: 0 },
      { name: 'Bạc', minPoints: '' },
      { name: 'Vàng', minPoints: '' },
      { name: 'Kim cương', minPoints: '' }
    ]
  });
});

test('saves the fixed membership tiers with configured thresholds and no benefits', async () => {
  const savedSettings = await saveLoyaltySettings({
    amountPerPoint: 10000,
    pointsPerAmount: 1,
    tiers: [
      { name: 'Custom 1', minPoints: 0, benefit: 'Ignored' },
      { name: 'Custom 2', minPoints: 100 },
      { name: 'Custom 3', minPoints: 500 },
      { name: 'Custom 4', minPoints: 1000 }
    ]
  });

  expect(savedSettings.tiers).toEqual([
    { name: 'Đồng', minPoints: 0 },
    { name: 'Bạc', minPoints: 100 },
    { name: 'Vàng', minPoints: 500 },
    { name: 'Kim cương', minPoints: 1000 }
  ]);
});

test('recalculates customer points from delivered spend and subtracts redeemed points when saving settings', async () => {
  const snapshot = (value) => ({ exists: () => true, val: () => value });
  let historyId = 0;
  get.mockImplementation(async ({ path }) => {
    if (path === 'customers') {
      return snapshot({
        'customer-1': {
          uid: 'auth-customer-1',
          email: 'buyer@example.com',
          points: 0,
          pointsHistory: {}
        }
      });
    }
    if (path === 'orders') {
      return snapshot({
        delivered1: {
          customerUid: 'old-google-uid',
          customer: { email: 'buyer@example.com' },
          status: 'delivered',
          totalAmount: 40000,
          createdAt: '2026-01-01T00:00:00.000Z'
        },
        delivered2: {
          customerUid: 'auth-customer-1',
          status: 'delivered',
          totalAmount: 20000,
          createdAt: '2026-01-02T00:00:00.000Z'
        },
        pending: {
          customerUid: 'auth-customer-1',
          status: 'pending',
          pointsRedeemed: 15
        }
      });
    }
    return { exists: () => false, val: () => null };
  });
  push.mockImplementation(() => ({ key: `history-${++historyId}` }));

  await saveLoyaltySettings({
    amountPerPoint: 1000,
    pointsPerAmount: 1,
    tiers: [
      { minPoints: 0 },
      { minPoints: 20 },
      { minPoints: 40 },
      { minPoints: 60 }
    ]
  });

  const updates = update.mock.calls[0][1];
  expect(updates).toMatchObject({
    'customers/customer-1/points': 45,
    'customers/customer-1/lifetimeSpend': 60000,
    'customers/customer-1/loyaltySpendRemainder': 0,
    'customers/customer-1/tier': 'Vàng',
    'customers/customer-1/loyaltyOrders/delivered1': {
      amount: 40000,
      points: 40,
      historyId: 'history-1'
    },
    'customers/customer-1/loyaltyOrders/delivered2': {
      amount: 20000,
      points: 20,
      historyId: 'history-2'
    },
    'orders/delivered1/loyaltyPointsAwarded': true,
    'orders/delivered1/customerUid': 'auth-customer-1',
    'orders/delivered1/loyaltyPointsAwardedPoints': 40,
    'orders/delivered2/loyaltyPointsAwarded': true,
    'orders/delivered2/loyaltyPointsAwardedPoints': 20
  });
});

test('rejects membership thresholds that are not in increasing order', async () => {
  await expect(saveLoyaltySettings({
    amountPerPoint: 10000,
    pointsPerAmount: 1,
    tiers: [
      { minPoints: 0 },
      { minPoints: 500 },
      { minPoints: 100 },
      { minPoints: 1000 }
    ]
  })).rejects.toThrow('Mốc điểm phải tăng dần');

  expect(update).not.toHaveBeenCalled();
});
