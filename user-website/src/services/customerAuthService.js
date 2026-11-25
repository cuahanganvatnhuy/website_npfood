import {
  FacebookAuthProvider,
  GoogleAuthProvider,
  EmailAuthProvider,
  RecaptchaVerifier,
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithPopup,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signOut,
  updatePassword,
  updateProfile
} from 'firebase/auth';
import { get, ref, set } from 'firebase/database';
import { auth, db } from './firebase';

const getCustomerProfileSaveError = (error) => {
  const code = String(error?.code || '');
  const message = String(error?.message || '');
  const isPermissionDenied = /permission.?denied/i.test(`${code} ${message}`);

  if (isPermissionDenied) {
    return new Error(
      'Không thể lưu hồ sơ khách hàng. Firebase Database từ chối quyền ghi; hãy publish database.rules.json lên đúng project Firebase rồi thử lại.'
    );
  }

  return new Error(`Không thể lưu hồ sơ khách hàng${message ? `: ${message}` : '. Vui lòng thử lại.'}`);
};

export const subscribeToCustomerAuth = (callback, onError) => (
  onAuthStateChanged(auth, callback, onError)
);

export const registerCustomerAccount = async ({ name, phone, email, password }) => {
  const normalizedEmail = email.trim().toLocaleLowerCase();
  const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
  const user = userCredential.user;
  const createdAt = new Date().toISOString();

  try {
    await updateProfile(user, { displayName: name.trim() });
    await set(ref(db, `customers/${user.uid}`), {
      uid: user.uid,
      name: name.trim(),
      phone: phone.trim(),
      email: normalizedEmail,
      points: 0,
      tier: 'Đồng',
      lifetimeSpend: 0,
      loyaltySpendRemainder: 0,
      isActive: true,
      createdAt,
      updatedAt: createdAt
    });
    return user;
  } catch (error) {
    console.error('Không thể lưu hồ sơ khách hàng sau khi đăng ký:', error);
    try {
      await deleteUser(user);
    } catch (deleteError) {
      console.error('Không thể hoàn tác tài khoản đăng ký chưa hoàn tất:', deleteError);
    }
    throw getCustomerProfileSaveError(error);
  }
};

export const signInCustomer = async (email, password) => {
  const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
  return userCredential.user;
};

const createCustomerProfileIfMissing = async (user, displayName = '') => {
  const email = String(user.email || '').trim().toLocaleLowerCase();
  const phone = user.phoneNumber || '';
  if (!email && !phone) throw new Error('Tài khoản chưa cung cấp email hoặc số điện thoại.');

  const customerRef = ref(db, `customers/${user.uid}`);
  const snapshot = await get(customerRef);
  if (snapshot.exists()) return user;

  const now = new Date().toISOString();
  try {
    await set(customerRef, {
      uid: user.uid,
      name: displayName.trim() || user.displayName || (email ? email.split('@')[0] : 'Khách hàng'),
      phone,
      email,
      points: 0,
      tier: 'Đồng',
      lifetimeSpend: 0,
      loyaltySpendRemainder: 0,
      isActive: true,
      createdAt: now,
      updatedAt: now
    });
  } catch (error) {
    throw getCustomerProfileSaveError(error);
  }
  return user;
};

const signInWithSocialProvider = async (provider) => {
  const userCredential = await signInWithPopup(auth, provider);
  try {
    return await createCustomerProfileIfMissing(userCredential.user);
  } catch (error) {
    console.error('Không thể tạo hồ sơ khách hàng cho tài khoản mạng xã hội:', error);
    try {
      await signOut(auth);
    } catch (signOutError) {
      console.error('Không thể đăng xuất sau khi tạo hồ sơ khách hàng thất bại:', signOutError);
    }
    throw error;
  }
};

export const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return signInWithSocialProvider(provider);
};

export const signInWithFacebook = async () => {
  const provider = new FacebookAuthProvider();
  provider.addScope('email');
  return signInWithSocialProvider(provider);
};

const normalizeVietnamPhone = (phone) => {
  const trimmedPhone = String(phone || '').trim().replace(/[\s().-]/g, '');
  if (/^0\d{9}$/.test(trimmedPhone)) return `+84${trimmedPhone.slice(1)}`;
  if (/^\+84\d{9}$/.test(trimmedPhone)) return trimmedPhone;
  if (/^84\d{9}$/.test(trimmedPhone)) return `+${trimmedPhone}`;
  throw new Error('Nhập số điện thoại Việt Nam gồm 10 số, bắt đầu bằng 0 hoặc +84.');
};

export const createCustomerPhoneVerifier = () => (
  new RecaptchaVerifier(auth, 'customer-phone-recaptcha', { size: 'normal' })
);

export const sendCustomerPhoneCode = async (phone, verifier) => {
  const normalizedPhone = normalizeVietnamPhone(phone);
  if (!verifier) throw new Error('Không thể khởi tạo xác minh. Hãy tải lại trang rồi thử lại.');
  const confirmation = await signInWithPhoneNumber(auth, normalizedPhone, verifier);
  return { confirmation, phoneNumber: normalizedPhone };
};

export const confirmCustomerPhoneCode = async (confirmation, code, name) => {
  const userCredential = await confirmation.confirm(String(code || '').trim());
  try {
    return await createCustomerProfileIfMissing(userCredential.user, name);
  } catch (error) {
    console.error('Không thể tạo hồ sơ khách hàng bằng số điện thoại:', error);
    try {
      await signOut(auth);
    } catch (signOutError) {
      console.error('Không thể đăng xuất sau khi tạo hồ sơ qua điện thoại thất bại:', signOutError);
    }
    throw getCustomerProfileSaveError(error);
  }
};

export const signOutCustomer = async () => {
  await signOut(auth);
};

export const changeCustomerPassword = async (user, currentPassword, newPassword) => {
  const hasPasswordProvider = user?.providerData?.some(
    (provider) => provider.providerId === 'password'
  );
  if (!hasPasswordProvider || !user.email) {
    throw new Error('Tài khoản này không sử dụng mật khẩu email.');
  }

  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
};

export const getCustomerProfile = async (uid) => {
  const snapshot = await get(ref(db, `customers/${uid}`));
  return snapshot.exists() ? snapshot.val() : null;
};
