import { push, ref, update } from 'firebase/database';
import { db } from './firebase';

export const saveCustomerAddress = async (customerUid, addressId, address, makeDefault) => {
  if (!customerUid) throw new Error('Vui lòng đăng nhập để lưu địa chỉ.');

  const addressesRef = ref(db, `customers/${customerUid}/addresses`);
  const addressRef = addressId
    ? ref(db, `customers/${customerUid}/addresses/${addressId}`)
    : push(addressesRef);
  if (!addressRef.key) throw new Error('Không thể tạo địa chỉ mới.');

  const now = new Date().toISOString();
  const savedAddress = {
    ...address,
    id: addressRef.key,
    createdAt: address.createdAt || now,
    updatedAt: now
  };
  const updates = {
    [`customers/${customerUid}/addresses/${addressRef.key}`]: savedAddress
  };
  if (makeDefault) {
    updates[`customers/${customerUid}/defaultAddressId`] = addressRef.key;
  }

  await update(ref(db), updates);
  return savedAddress;
};

export const setDefaultCustomerAddress = async (customerUid, addressId) => {
  if (!customerUid || !addressId) throw new Error('Không xác định được địa chỉ mặc định.');
  await update(ref(db), {
    [`customers/${customerUid}/defaultAddressId`]: addressId
  });
};

export const deleteCustomerAddress = async (
  customerUid,
  addressId,
  defaultAddressId,
  nextDefaultAddressId = ''
) => {
  if (!customerUid || !addressId) throw new Error('Không xác định được địa chỉ cần xóa.');

  const updates = {
    [`customers/${customerUid}/addresses/${addressId}`]: null
  };
  if (defaultAddressId === addressId) {
    updates[`customers/${customerUid}/defaultAddressId`] = nextDefaultAddressId || null;
  }
  await update(ref(db), updates);
};
