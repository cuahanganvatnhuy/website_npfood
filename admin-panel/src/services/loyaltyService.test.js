jest.mock('./firebase.js', () => ({ db: {} }));
jest.mock('firebase/database', () => ({
  get: jest.fn(),
  push: jest.fn(),
  ref: jest.fn(),
  runTransaction: jest.fn(),
  update: jest.fn()
}));

import { get, push, ref, runTransaction, update } from 'firebase/database';
import {
  awardPointsForDeliveredOrder,
  calculateLoyaltyAccrual
} from './loyaltyService.js';

let customer;
let historyId;

const makeSnapshot = (value) => ({
  exists: () => value !== null,
  val: () => value
});

beforeEach(() => {
  jest.clearAllMocks();
  historyId = 0;
  customer = { email: 'buyer@example.com', points: 0 };
  ref.mockImplementation((database, path) => ({ path }));
  push.mockImplementation(() => ({ key: `history-${++historyId}` }));
  get.mockImplementation(async ({ path }) => {
    if (path === 'customers') return makeSnapshot({ customerId: { email: customer.email } });
    if (path === 'loyaltySettings') {
      return makeSnapshot({
        amountPerPoint: 10000,
        pointsPerAmount: 1,
        tiers: [{ name: 'Đồng', minPoints: 0 }]
      });
    }
    return makeSnapshot(null);
  });
  runTransaction.mockImplementation(async (customerRef, updater) => {
    const updated = updater(customer);
    if (!updated) return { committed: false, snapshot: makeSnapshot(customer) };
    customer = updated;
    return { committed: true, snapshot: makeSnapshot(customer) };
  });
  update.mockResolvedValue(undefined);
});

test('carries unconverted spend across purchases until it reaches the point threshold', () => {
  const firstPurchase = calculateLoyaltyAccrual({
    spendRemainder: 0,
    amount: 6000,
    amountPerPoint: 10000,
    pointsPerAmount: 1
  });
  const secondPurchase = calculateLoyaltyAccrual({
    spendRemainder: firstPurchase.remainder,
    amount: 9000,
    amountPerPoint: 10000,
    pointsPerAmount: 1
  });

  expect(firstPurchase).toEqual({ points: 0, remainder: 6000 });
  expect(secondPurchase).toEqual({ points: 1, remainder: 5000 });
});

test('awards multiple points for cumulative spend and preserves the remainder', () => {
  expect(calculateLoyaltyAccrual({
    spendRemainder: 5000,
    amount: 25000,
    amountPerPoint: 10000,
    pointsPerAmount: 1
  })).toEqual({ points: 3, remainder: 0 });
});

test('assigns the fixed tier name using the configured point thresholds', async () => {
  customer.points = 99;
  get.mockImplementation(async ({ path }) => {
    if (path === 'customers') return makeSnapshot({ customerId: { email: customer.email } });
    if (path === 'loyaltySettings') {
      return makeSnapshot({
        amountPerPoint: 10000,
        pointsPerAmount: 1,
        tiers: [
          { name: 'Old bronze', minPoints: 0 },
          { name: 'Old silver', minPoints: 100 },
          { name: 'Old gold', minPoints: 500 },
          { name: 'Old diamond', minPoints: 1000 }
        ]
      });
    }
    return makeSnapshot(null);
  });

  await awardPointsForDeliveredOrder('silver-order', {
    status: 'delivered',
    customer: { email: customer.email },
    totalAmount: 10000
  });

  expect(customer).toMatchObject({ points: 100, tier: 'Bạc' });
});

test('records a delivered order only once even if the status update is repeated', async () => {
  const order = {
    orderNumber: 'NP-10000001',
    status: 'delivered',
    customer: { email: ' BUYER@example.com ' },
    totalAmount: 12500
  };

  const firstResult = await awardPointsForDeliveredOrder('order-1', order);
  const repeatedResult = await awardPointsForDeliveredOrder('order-1', order);

  expect(firstResult.status).toBe('awarded');
  expect(repeatedResult.status).toBe('already_applied');
  expect(customer).toMatchObject({
    points: 1,
    lifetimeSpend: 12500,
    loyaltySpendRemainder: 2500
  });
  expect(Object.keys(customer.pointsHistory)).toHaveLength(1);
  expect(runTransaction).toHaveBeenCalledTimes(2);
});

test('recognizes delivered status with surrounding whitespace', async () => {
  const result = await awardPointsForDeliveredOrder('trimmed-status-order', {
    status: ' delivered ',
    customer: { email: customer.email },
    totalAmount: 10000
  });

  expect(result.status).toBe('awarded');
  expect(customer.lifetimeSpend).toBe(10000);
  expect(customer.points).toBe(1);
});

test('resolves a customer by account UID even when the profile key differs and email does not match', async () => {
  customer = { uid: 'auth-customer-1', email: 'registered@example.com', points: 0 };
  get.mockImplementation(async ({ path }) => {
    if (path === 'customers') return makeSnapshot({ 'legacy-profile-key': customer });
    if (path === 'loyaltySettings') {
      return makeSnapshot({
        amountPerPoint: 10000,
        pointsPerAmount: 1,
        tiers: [{ name: 'Đồng', minPoints: 0 }]
      });
    }
    return makeSnapshot(null);
  });

  const result = await awardPointsForDeliveredOrder('uid-linked-order', {
    customerUid: 'auth-customer-1',
    customer: { email: 'different-contact@example.com' },
    status: 'delivered',
    totalAmount: 10000
  });

  expect(result).toMatchObject({ status: 'awarded', customerId: 'legacy-profile-key', points: 1 });
  expect(update).toHaveBeenCalledWith(
    { path: 'orders/uid-linked-order' },
    expect.objectContaining({ customerUid: 'auth-customer-1', loyaltyPointsAwarded: true })
  );
});

test('falls back to the unique email profile when an order UID is stale', async () => {
  const result = await awardPointsForDeliveredOrder('unresolved-uid-order', {
    customerUid: 'missing-auth-customer',
    customer: { email: customer.email },
    status: 'delivered',
    totalAmount: 10000
  });

  expect(result).toMatchObject({
    status: 'awarded',
    customerId: 'customerId',
    points: 1
  });
  expect(customer).toMatchObject({ points: 1, lifetimeSpend: 10000 });
  expect(update).toHaveBeenCalledWith(
    { path: 'orders/unresolved-uid-order' },
    expect.objectContaining({ customerUid: 'customerId', loyaltyPointsAwarded: true })
  );
});

test('does not guess between multiple profiles with the same fallback email', async () => {
  get.mockImplementation(async ({ path }) => {
    if (path === 'customers') {
      return makeSnapshot({
        first: { email: customer.email },
        second: { email: customer.email }
      });
    }
    if (path === 'loyaltySettings') {
      return makeSnapshot({ amountPerPoint: 10000, pointsPerAmount: 1 });
    }
    return makeSnapshot(null);
  });

  const result = await awardPointsForDeliveredOrder('ambiguous-email-order', {
    customerUid: 'missing-auth-customer',
    customer: { email: customer.email },
    status: 'delivered',
    totalAmount: 10000
  });

  expect(result.status).toBe('ambiguous_customer');
  expect(runTransaction).not.toHaveBeenCalled();
  expect(update).not.toHaveBeenCalled();
});

test('reports a failed transaction separately when the UID profile exists', async () => {
  runTransaction.mockResolvedValue({
    committed: false,
    snapshot: makeSnapshot(customer)
  });

  const result = await awardPointsForDeliveredOrder('transaction-failure-order', {
    customerUid: 'customerId',
    customer: { email: 'buyer@example.com' },
    status: 'delivered',
    totalAmount: 10000
  });

  expect(result).toMatchObject({
    status: 'loyalty_transaction_not_committed',
    orderUid: 'customerId',
    customerId: 'customerId'
  });
  expect(update).not.toHaveBeenCalled();
});

test('awards points to a phone-only account using the order customer UID', async () => {
  customer = { phone: '+84900123456', points: 0 };
  get.mockImplementation(async ({ path }) => {
    if (path === 'customers') return makeSnapshot({ phoneCustomer: customer });
    if (path === 'loyaltySettings') {
      return makeSnapshot({
        amountPerPoint: 10000,
        pointsPerAmount: 1,
        tiers: [{ name: 'Đồng', minPoints: 0 }]
      });
    }
    return makeSnapshot(null);
  });

  const result = await awardPointsForDeliveredOrder('phone-order', {
    orderNumber: 'NP-PHONE01',
    customerUid: 'phoneCustomer',
    customer: { phone: '+84900123456' },
    status: 'delivered',
    totalAmount: 20000
  });

  expect(result).toMatchObject({ status: 'awarded', customerId: 'phoneCustomer', points: 2 });
  expect(customer.lifetimeSpend).toBe(20000);
});
