jest.mock('./firebase', () => ({ db: {} }));
jest.mock('firebase/database', () => ({
  push: jest.fn(),
  ref: jest.fn((database, path) => ({ path })),
  update: jest.fn()
}));

import { push, ref, update } from 'firebase/database';
import { deleteCustomerAddress, saveCustomerAddress } from './addressService';

beforeEach(() => {
  jest.clearAllMocks();
  ref.mockImplementation((database, path) => ({ path }));
  push.mockReturnValue({ key: 'address-1' });
});

test('saves a customer address and marks the first one as default', async () => {
  const address = {
    name: 'Nguyễn An',
    phone: '0900000000',
    province: 'Đắk Lắk',
    ward: 'Phường Tuy Hòa',
    street: '1 Đường A',
    detailAddress: 'Căn hộ 5A',
    address: '1 Đường A, Phường Tuy Hòa, Đắk Lắk',
    latitude: 10.77,
    longitude: 106.69
  };

  const savedAddress = await saveCustomerAddress('customer-1', '', address, true);

  expect(savedAddress).toMatchObject({ ...address, id: 'address-1' });
  expect(update).toHaveBeenCalledWith(
    { path: undefined },
    expect.objectContaining({
      'customers/customer-1/addresses/address-1': expect.objectContaining({
        ...address,
        id: 'address-1',
        createdAt: expect.any(String),
        updatedAt: expect.any(String)
      }),
      'customers/customer-1/defaultAddressId': 'address-1'
    })
  );
});

test('deletes an address and assigns the next saved address as default', async () => {
  await deleteCustomerAddress('customer-1', 'address-1', 'address-1', 'address-2');

  expect(update).toHaveBeenCalledWith(
    { path: undefined },
    {
      'customers/customer-1/addresses/address-1': null,
      'customers/customer-1/defaultAddressId': 'address-2'
    }
  );
});
