jest.mock('./firebase', () => ({ auth: {}, db: {} }));
jest.mock('firebase/auth', () => ({
  FacebookAuthProvider: jest.fn().mockImplementation(() => ({ addScope: jest.fn() })),
  GoogleAuthProvider: jest.fn().mockImplementation(() => ({ setCustomParameters: jest.fn() })),
  RecaptchaVerifier: jest.fn().mockImplementation(() => ({ clear: jest.fn() })),
  createUserWithEmailAndPassword: jest.fn(),
  deleteUser: jest.fn(),
  onAuthStateChanged: jest.fn(),
  signInWithPopup: jest.fn(),
  signInWithPhoneNumber: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  updateProfile: jest.fn()
}));
jest.mock('firebase/database', () => ({
  get: jest.fn(),
  ref: jest.fn((database, path) => ({ path })),
  set: jest.fn()
}));

import {
  createUserWithEmailAndPassword,
  deleteUser,
  GoogleAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithPopup,
  updateProfile
} from 'firebase/auth';
import { get, ref, set } from 'firebase/database';
import {
  confirmCustomerPhoneCode,
  createCustomerPhoneVerifier,
  registerCustomerAccount,
  sendCustomerPhoneCode,
  signInWithGoogle
} from './customerAuthService';

beforeEach(() => {
  jest.clearAllMocks();
  ref.mockImplementation((database, path) => ({ path }));
});

test('creates a Firebase auth account and customer loyalty profile', async () => {
  const user = { uid: 'customer-1' };
  createUserWithEmailAndPassword.mockResolvedValue({ user });

  await registerCustomerAccount({
    name: '  Minh Anh ',
    phone: '0900123456',
    email: ' MINH.ANH@example.com ',
    password: 'secret1'
  });

  expect(createUserWithEmailAndPassword).toHaveBeenCalledWith({}, 'minh.anh@example.com', 'secret1');
  expect(updateProfile).toHaveBeenCalledWith(user, { displayName: 'Minh Anh' });
  expect(set).toHaveBeenCalledWith(
    { path: 'customers/customer-1' },
    expect.objectContaining({
      uid: 'customer-1',
      name: 'Minh Anh',
      phone: '0900123456',
      email: 'minh.anh@example.com',
      points: 0,
      tier: 'Đồng',
      isActive: true
    })
  );
});

test('removes the auth user and surfaces an error if saving the customer profile fails', async () => {
  const user = { uid: 'customer-1' };
  createUserWithEmailAndPassword.mockResolvedValue({ user });
  set.mockRejectedValue(new Error('permission denied'));

  await expect(registerCustomerAccount({
    name: 'Minh Anh',
    phone: '0900123456',
    email: 'minh.anh@example.com',
    password: 'secret1'
  })).rejects.toThrow('publish database.rules.json');

  expect(deleteUser).toHaveBeenCalledWith(user);
});

test('creates a customer profile on the first Google sign-in', async () => {
  const user = {
    uid: 'google-customer',
    email: 'google@example.com',
    displayName: 'Google Customer',
    phoneNumber: null
  };
  const customerRef = { path: 'customers/google-customer' };
  signInWithPopup.mockResolvedValue({ user });
  get.mockResolvedValue({ exists: () => false });

  await signInWithGoogle();

  expect(GoogleAuthProvider).toHaveBeenCalledTimes(1);
  expect(signInWithPopup).toHaveBeenCalledWith({}, expect.any(Object));
  expect(set).toHaveBeenCalledWith(
    customerRef,
    expect.objectContaining({
      uid: 'google-customer',
      email: 'google@example.com',
      name: 'Google Customer',
      points: 0,
      tier: 'Đồng'
    })
  );
});

test('normalizes a Vietnamese phone number before requesting an SMS code', async () => {
  const verifier = { clear: jest.fn() };
  const confirmation = { confirm: jest.fn() };
  RecaptchaVerifier.mockImplementation(() => verifier);
  signInWithPhoneNumber.mockResolvedValue(confirmation);

  const result = await sendCustomerPhoneCode('0900123456', createCustomerPhoneVerifier());

  expect(signInWithPhoneNumber).toHaveBeenCalledWith({}, '+84900123456', verifier);
  expect(RecaptchaVerifier).toHaveBeenCalledWith({}, 'customer-phone-recaptcha', { size: 'normal' });
  expect(result).toEqual({ confirmation, phoneNumber: '+84900123456' });
});

test('creates a loyalty profile after confirming a phone verification code', async () => {
  const user = {
    uid: 'phone-customer',
    phoneNumber: '+84900123456',
    email: null
  };
  const confirmation = { confirm: jest.fn().mockResolvedValue({ user }) };
  get.mockResolvedValue({ exists: () => false });

  await confirmCustomerPhoneCode(confirmation, '123456', 'Minh Anh');

  expect(confirmation.confirm).toHaveBeenCalledWith('123456');
  expect(set).toHaveBeenCalledWith(
    { path: 'customers/phone-customer' },
    expect.objectContaining({
      uid: 'phone-customer',
      name: 'Minh Anh',
      phone: '+84900123456',
      email: '',
      points: 0,
      tier: 'Đồng'
    })
  );
});
