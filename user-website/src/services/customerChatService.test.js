jest.mock('./firebase', () => ({ db: {} }));
jest.mock('firebase/database', () => ({
  onValue: jest.fn(),
  push: jest.fn(),
  ref: jest.fn((database, path) => ({ path })),
  set: jest.fn()
}));

import { onValue, push, ref, set } from 'firebase/database';
import { sendCustomerChatMessage, subscribeToCustomerChat } from './customerChatService';

beforeEach(() => {
  jest.clearAllMocks();
  push.mockReturnValue({ key: 'message-1' });
  set.mockResolvedValue();
});

test('sends a trimmed customer message to that customer conversation', async () => {
  await expect(sendCustomerChatMessage('customer-1', {
    text: '  Xin chào shop  ',
    senderName: 'Lan',
    email: 'lan@example.com'
  })).resolves.toBe('message-1');

  expect(ref).toHaveBeenCalledWith({}, 'customerChats/customer-1/messages');
  expect(set).toHaveBeenCalledWith(
    { key: 'message-1' },
    expect.objectContaining({
      text: 'Xin chào shop',
      sender: 'customer',
      senderName: 'Lan',
      email: 'lan@example.com'
    })
  );
});

test('rejects empty or oversized messages before writing', async () => {
  await expect(sendCustomerChatMessage('customer-1', { text: '  ' })).rejects.toThrow('Vui lòng nhập');
  await expect(sendCustomerChatMessage('customer-1', { text: 'x'.repeat(2001) })).rejects.toThrow('2.000');
  expect(set).not.toHaveBeenCalled();
});

test('sends a product card as a customer chat message', async () => {
  await sendCustomerChatMessage('customer-1', {
    senderName: 'Lan',
    email: 'lan@example.com',
    product: {
      id: 'product-1',
      name: 'Phô mai mozzarella',
      imageUrl: 'https://example.com/product.png',
      price: 75000,
      originalPrice: 135000
    }
  });

  expect(set).toHaveBeenCalledWith(
    { key: 'message-1' },
    expect.objectContaining({
      text: 'Mình muốn hỏi thêm về sản phẩm này.',
      sender: 'customer',
      product: {
        id: 'product-1',
        name: 'Phô mai mozzarella',
        imageUrl: 'https://example.com/product.png',
        price: 75000,
        originalPrice: 135000
      }
    })
  );
});

test('subscribes to and sorts the signed-in customer conversation', () => {
  const onMessages = jest.fn();
  const unsubscribe = jest.fn();
  onValue.mockImplementation((chatRef, callback) => {
    callback({
      exists: () => true,
      forEach: (visit) => {
        visit({ key: 'later', val: () => ({ text: 'Sau', createdAt: '2026-01-02T00:00:00.000Z' }) });
        visit({ key: 'earlier', val: () => ({ text: 'Trước', createdAt: '2026-01-01T00:00:00.000Z' }) });
      }
    });
    return unsubscribe;
  });

  expect(subscribeToCustomerChat('customer-1', onMessages, jest.fn())).toBe(unsubscribe);
  expect(onMessages.mock.calls[0][0].map((message) => message.id)).toEqual(['earlier', 'later']);
});
