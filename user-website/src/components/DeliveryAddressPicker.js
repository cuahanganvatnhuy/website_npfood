import { useEffect, useState } from 'react';
import {
  deleteCustomerAddress,
  saveCustomerAddress,
  setDefaultCustomerAddress
} from '../services/addressService';
import { getVietnamProvinces, getVietnamWards } from '../services/vietnamLocationService';
import '../css/DeliveryAddressPicker.css';

const blankAddress = {
  name: '',
  phone: '',
  province: '',
  ward: '',
  street: '',
  detailAddress: '',
  latitude: null,
  longitude: null
};
const formatAddress = (address) => (
  [address.street, address.detailAddress, address.ward, address.province].filter(Boolean).join(', ')
);

const getProfileAddresses = (profile) => {
  const addresses = Object.entries(profile?.addresses || {})
    .filter(([, address]) => address && typeof address === 'object')
    .map(([id, address]) => ({
      ...address,
      id: address.id || id,
      address: address.address || formatAddress(address)
    }));
  if (addresses.length === 0 && profile?.address) {
    addresses.push({
      ...blankAddress,
      id: 'legacy',
      name: profile.name || '',
      phone: profile.phone || '',
      street: profile.address,
      address: profile.address,
      isLegacy: true
    });
  }
  return addresses;
};

const getCurrentPosition = () => new Promise((resolve, reject) => {
  if (!navigator.geolocation) {
    reject(new Error('Trình duyệt này không hỗ trợ lấy vị trí hiện tại.'));
    return;
  }
  navigator.geolocation.getCurrentPosition(resolve, reject, {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 60000
  });
});

const getLocationError = (error) => {
  if (error?.code === 1) return 'Bạn chưa cấp quyền truy cập vị trí cho trình duyệt.';
  if (error?.code === 2) return 'Không xác định được vị trí hiện tại. Vui lòng thử lại.';
  if (error?.code === 3) return 'Lấy vị trí quá thời gian. Vui lòng thử lại.';
  return error?.message || 'Không thể lấy địa chỉ hiện tại. Vui lòng thử lại.';
};

const DeliveryAddressPicker = ({
  user,
  profile,
  profileLoading,
  deliveryMethod,
  onDeliveryMethodChange,
  onAddressChange
}) => {
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [defaultAddressId, setDefaultAddressId] = useState('');
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [pendingAddressId, setPendingAddressId] = useState('');
  const [addressPickerOpen, setAddressPickerOpen] = useState(false);
  const [addressFormOpen, setAddressFormOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState('');
  const [addressForm, setAddressForm] = useState(blankAddress);
  const [showAddressDetails, setShowAddressDetails] = useState(false);
  const [manualRegionEntry, setManualRegionEntry] = useState(false);
  const [regionPickerOpen, setRegionPickerOpen] = useState(false);
  const [regionStep, setRegionStep] = useState('province');
  const [provinceOptions, setProvinceOptions] = useState([]);
  const [wardOptions, setWardOptions] = useState([]);
  const [selectedProvinceCode, setSelectedProvinceCode] = useState('');
  const [regionSearch, setRegionSearch] = useState('');
  const [regionLoading, setRegionLoading] = useState(false);
  const [regionError, setRegionError] = useState('');
  const [addressError, setAddressError] = useState('');
  const [locationMessage, setLocationMessage] = useState('');
  const [locating, setLocating] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);

  useEffect(() => {
    if (profileLoading) {
      setSavedAddresses([]);
      setDefaultAddressId('');
      setSelectedAddressId('');
      setPendingAddressId('');
      onAddressChange(null);
      return;
    }
    const addresses = getProfileAddresses(profile);
    const storedDefault = profile?.defaultAddressId ||
      addresses.find((address) => !address.isLegacy)?.id ||
      addresses[0]?.id ||
      '';
    const initialAddress = addresses.find((address) => address.id === storedDefault) ||
      addresses[0] ||
      null;
    const defaultId = initialAddress?.id || '';
    setSavedAddresses(addresses);
    setDefaultAddressId(defaultId);
    setSelectedAddressId(initialAddress?.id || '');
    setPendingAddressId(initialAddress?.id || '');
    onAddressChange(initialAddress);
  }, [profile, profileLoading, onAddressChange]);

  const selectedAddress = savedAddresses.find((address) => address.id === selectedAddressId);
  const pendingAddress = savedAddresses.find((address) => address.id === pendingAddressId);
  const regionOptions = regionStep === 'province' ? provinceOptions : wardOptions;
  const filteredRegionOptions = regionOptions.filter((option) => (
    option.name.toLocaleLowerCase('vi').includes(regionSearch.trim().toLocaleLowerCase('vi'))
  ));

  const openAddressPicker = () => {
    setPendingAddressId(selectedAddressId);
    setAddressError('');
    setAddressPickerOpen(true);
  };

  const openAddressForm = (address = null) => {
    setEditingAddressId(address?.id || '');
    setShowAddressDetails(Boolean(address && (
      address.province || address.ward || address.street || address.address
    )));
    setAddressForm({
      ...blankAddress,
      name: profile?.name || user?.displayName || '',
      phone: profile?.phone || user?.phoneNumber || '',
      ...address,
      street: address?.street || address?.address || ''
    });
    setAddressError('');
    setLocationMessage('');
    setManualRegionEntry(false);
    setAddressFormOpen(true);
  };

  const openRegionPicker = async (requestedStep = 'province') => {
    setRegionPickerOpen(true);
    setRegionStep('province');
    setRegionSearch('');
    setRegionError('');
    setRegionLoading(true);
    try {
      const provinces = await getVietnamProvinces();
      setProvinceOptions(provinces);
      const currentProvince = provinces.find((province) => province.name === addressForm.province);
      const provinceCode = currentProvince?.code || '';
      setSelectedProvinceCode(provinceCode);
      if (requestedStep === 'ward' && provinceCode) {
        setWardOptions(await getVietnamWards(provinceCode));
        setRegionStep('ward');
      }
    } catch (error) {
      console.error('Không thể tải danh sách khu vực:', error);
      setRegionError(error.message || 'Không thể tải danh sách khu vực. Bạn có thể nhập thủ công.');
    } finally {
      setRegionLoading(false);
    }
  };

  const openWardStep = async () => {
    if (!selectedProvinceCode) return;
    setRegionStep('ward');
    setRegionSearch('');
    setRegionError('');
    setRegionLoading(true);
    try {
      setWardOptions(await getVietnamWards(selectedProvinceCode));
    } catch (error) {
      console.error('Không thể tải danh sách phường/xã:', error);
      setRegionError(error.message || 'Không thể tải danh sách phường/xã. Bạn có thể nhập thủ công.');
    } finally {
      setRegionLoading(false);
    }
  };

  const chooseProvince = async (province) => {
    setSelectedProvinceCode(province.code);
    setShowAddressDetails(true);
    setManualRegionEntry(false);
    setAddressForm((current) => ({ ...current, province: province.name, ward: '' }));
    setRegionStep('ward');
    setRegionSearch('');
    setRegionError('');
    setRegionLoading(true);
    try {
      setWardOptions(await getVietnamWards(province.code));
    } catch (error) {
      console.error('Không thể tải danh sách phường/xã:', error);
      setRegionError(error.message || 'Không thể tải danh sách phường/xã. Bạn có thể nhập thủ công.');
    } finally {
      setRegionLoading(false);
    }
  };

  const chooseWard = (ward) => {
    setShowAddressDetails(true);
    setManualRegionEntry(false);
    setAddressForm((current) => ({ ...current, ward: ward.name }));
    setRegionPickerOpen(false);
  };

  const handleUseCurrentLocation = async () => {
    setLocating(true);
    setAddressError('');
    setLocationMessage('');
    try {
      const position = await getCurrentPosition();
      const { latitude, longitude } = position.coords;
      const url = new URL('https://nominatim.openstreetmap.org/reverse');
      url.searchParams.set('format', 'jsonv2');
      url.searchParams.set('addressdetails', '1');
      url.searchParams.set('accept-language', 'vi');
      url.searchParams.set('lat', String(latitude));
      url.searchParams.set('lon', String(longitude));
      const response = await fetch(url.toString(), {
        headers: { 'Accept-Language': 'vi' }
      });
      if (!response.ok) throw new Error('Dịch vụ bản đồ đang bận. Vui lòng nhập địa chỉ thủ công.');

      const result = await response.json();
      if (!result.address) {
        throw new Error('Không tìm thấy địa chỉ tại vị trí này. Vui lòng nhập địa chỉ thủ công.');
      }
      const location = result.address;
      const province = location.state || location.province || location.region ||
        location.city || location.municipality || location.town || location.village ||
        location.county || '';
      const ward = location.suburb || location.neighbourhood || location.quarter ||
        location.city_district || location.district || location.borough || '';
      const street = [location.house_number, location.road].filter(Boolean).join(' ');

      setAddressForm((current) => ({
        ...current,
        province,
        ward,
        street,
        detailAddress: '',
        latitude,
        longitude
      }));
      setShowAddressDetails(true);
      setManualRegionEntry(false);
      setLocationMessage(!province || !ward
        ? 'Đã lấy vị trí. Hãy bổ sung khu vực còn thiếu hoặc nhập địa chỉ chi tiết.'
        : 'Đã tìm địa chỉ từ vị trí hiện tại. Vui lòng kiểm tra lại thông tin trước khi lưu.');
      setRegionPickerOpen(false);
    } catch (error) {
      console.error('Không thể tìm địa chỉ từ vị trí hiện tại:', error);
      const message = getLocationError(error);
      setAddressError(message);
      if (regionPickerOpen) setRegionError(message);
    } finally {
      setLocating(false);
    }
  };

  const handleSaveAddress = async (event) => {
    event.preventDefault();
    setAddressError('');
    const address = {
      name: addressForm.name.trim(),
      phone: addressForm.phone.trim(),
      province: addressForm.province.trim(),
      ward: addressForm.ward.trim(),
      street: addressForm.street.trim(),
      detailAddress: addressForm.detailAddress.trim(),
      address: formatAddress({
        street: addressForm.street.trim(),
        detailAddress: addressForm.detailAddress.trim(),
        ward: addressForm.ward.trim(),
        province: addressForm.province.trim()
      }),
      latitude: typeof addressForm.latitude === 'number' && Number.isFinite(addressForm.latitude)
        ? addressForm.latitude
        : null,
      longitude: typeof addressForm.longitude === 'number' && Number.isFinite(addressForm.longitude)
        ? addressForm.longitude
        : null
    };
    if (![address.name, address.phone, address.province, address.ward, address.street].every(Boolean)) {
      setAddressError('Vui lòng nhập đầy đủ tên, số điện thoại và địa chỉ nhận hàng.');
      return;
    }

    setSavingAddress(true);
    try {
      const shouldBeDefault = !defaultAddressId ||
        defaultAddressId === 'legacy' ||
        defaultAddressId === editingAddressId;
      const addressId = editingAddressId && editingAddressId !== 'legacy'
        ? editingAddressId
        : '';
      const savedAddress = await saveCustomerAddress(user.uid, addressId, address, shouldBeDefault);
      const nextAddresses = [
        ...savedAddresses.filter((item) => item.id !== editingAddressId),
        savedAddress
      ];
      setSavedAddresses(nextAddresses);
      setSelectedAddressId(savedAddress.id);
      setPendingAddressId(savedAddress.id);
      if (shouldBeDefault) setDefaultAddressId(savedAddress.id);
      onAddressChange(savedAddress);
      setAddressPickerOpen(false);
      setAddressFormOpen(false);
    } catch (error) {
      console.error('Không thể lưu địa chỉ nhận hàng:', error);
      setAddressError(error.message || 'Không thể lưu địa chỉ. Vui lòng thử lại.');
    } finally {
      setSavingAddress(false);
    }
  };

  const handleSetDefault = async (address) => {
    try {
      await setDefaultCustomerAddress(user.uid, address.id);
      setDefaultAddressId(address.id);
    } catch (error) {
      console.error('Không thể đặt địa chỉ mặc định:', error);
      setAddressError(error.message || 'Không thể cập nhật địa chỉ mặc định.');
    }
  };

  const handleDeleteAddress = async (address) => {
    if (address.isLegacy || !window.confirm('Bạn có chắc muốn xóa địa chỉ này?')) return;
    const remainingAddresses = savedAddresses.filter((item) => item.id !== address.id);
    const nextDefaultId = address.id === defaultAddressId
      ? remainingAddresses.find((item) => !item.isLegacy)?.id || ''
      : defaultAddressId;
    try {
      await deleteCustomerAddress(user.uid, address.id, defaultAddressId, nextDefaultId);
      setSavedAddresses(remainingAddresses);
      if (address.id === defaultAddressId) setDefaultAddressId(nextDefaultId);
      if (address.id === selectedAddressId) {
        const nextSelected = remainingAddresses.find((item) => item.id === nextDefaultId) ||
          remainingAddresses[0] ||
          null;
        setSelectedAddressId(nextSelected?.id || '');
        setPendingAddressId(nextSelected?.id || '');
        onAddressChange(nextSelected);
      }
    } catch (error) {
      console.error('Không thể xóa địa chỉ nhận hàng:', error);
      setAddressError(error.message || 'Không thể xóa địa chỉ. Vui lòng thử lại.');
    }
  };

  const confirmAddress = () => {
    if (!pendingAddress) return;
    setSelectedAddressId(pendingAddress.id);
    onAddressChange(pendingAddress);
    setAddressPickerOpen(false);
  };

  return (
    <section className="store-delivery-card" aria-label="Thông tin nhận hàng">
      <div className="store-delivery-methods" role="group" aria-label="Chọn hình thức nhận hàng">
        <button
          type="button"
          className={deliveryMethod === 'delivery' ? 'is-active' : ''}
          aria-pressed={deliveryMethod === 'delivery'}
          onClick={() => onDeliveryMethodChange('delivery')}
        >
          <span className="store-delivery-radio" aria-hidden="true" />
          Giao tận nơi
        </button>
        <button
          type="button"
          className={deliveryMethod === 'pickup' ? 'is-active' : ''}
          aria-pressed={deliveryMethod === 'pickup'}
          onClick={() => onDeliveryMethodChange('pickup')}
        >
          <span className="store-delivery-radio" aria-hidden="true" />
          Nhận tại cửa hàng
        </button>
      </div>

      {deliveryMethod === 'delivery' ? (
        <button
          type="button"
          className="store-delivery-address-summary"
          onClick={openAddressPicker}
        >
          <span className="store-delivery-pin" aria-hidden="true">⌖</span>
          <span>
            <strong>
              {selectedAddress
                ? `${selectedAddress.name} · ${selectedAddress.phone}`
                : 'Chọn địa chỉ nhận hàng'}
            </strong>
            <small>
              {selectedAddress
                ? selectedAddress.address || formatAddress(selectedAddress)
                : 'Thêm địa chỉ hoặc chọn địa chỉ đã lưu'}
            </small>
          </span>
          <span className="store-delivery-chevron" aria-hidden="true">›</span>
        </button>
      ) : (
        <p className="store-delivery-pickup-note">
          Khách nhận hàng tại cửa hàng. Không cần nhập địa chỉ giao hàng.
        </p>
      )}

      {addressPickerOpen && (
        <div
          className="store-address-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setAddressPickerOpen(false);
          }}
        >
          <section
            className="store-address-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="store-address-modal-title"
          >
            <header className={`store-address-modal-header${addressFormOpen ? ' is-form' : ''}`}>
              {addressFormOpen && (
                <button
                  type="button"
                  className="store-address-back"
                  aria-label="Quay lại danh sách địa chỉ"
                  onClick={() => {
                    setAddressFormOpen(false);
                    setAddressError('');
                  }}
                >
                  ‹
                </button>
              )}
              <h2 id="store-address-modal-title">
                {addressFormOpen
                  ? editingAddressId ? 'Sửa địa chỉ nhận hàng' : 'Thêm địa chỉ mới'
                  : 'Chọn địa chỉ nhận hàng'}
              </h2>
              <button
                type="button"
                aria-label={addressFormOpen ? 'Đóng thêm địa chỉ' : 'Đóng danh sách địa chỉ'}
                onClick={() => {
                  setAddressPickerOpen(false);
                  setAddressFormOpen(false);
                }}
              >
                ×
              </button>
            </header>

            {addressFormOpen ? (
              <form className="store-address-form" onSubmit={handleSaveAddress}>
                <button
                  type="button"
                  className="store-address-current-location"
                  onClick={handleUseCurrentLocation}
                  disabled={locating}
                >
                  {locating ? 'Đang lấy vị trí...' : '◎  Dùng vị trí hiện tại'}
                </button>
                <div className="store-address-or" aria-hidden="true">
                  <span />
                  <span>Hoặc</span>
                  <span />
                </div>
                <button
                  type="button"
                  className="store-address-region-select"
                  onClick={openRegionPicker}
                >
                  <span className="store-address-region-choice-copy">
                    <strong>
                      {addressForm.province && addressForm.ward
                        ? 'Đổi địa chỉ'
                        : 'Chọn địa chỉ'}
                    </strong>
                    <small>
                      {addressForm.province && addressForm.ward
                        ? `${addressForm.province} · ${addressForm.ward}`
                        : 'Nhập địa chỉ theo Tỉnh/TP, Phường/Xã'}
                    </small>
                  </span>
                  <span aria-hidden="true">›</span>
                </button>
                <p className="store-address-location-notice">
                  Chọn khu vực từ danh sách để điền tỉnh/thành phố và phường/xã.
                </p>
                <p className="store-address-location-notice">
                  Khi dùng GPS, tọa độ được gửi đến OpenStreetMap để tra cứu địa chỉ.{' '}
                  <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
                    © OpenStreetMap contributors
                  </a>
                </p>
                {locationMessage && <p className="store-address-success">{locationMessage}</p>}
                <label>
                  Tên người nhận
                  <input
                    value={addressForm.name}
                    onChange={(event) => setAddressForm({ ...addressForm, name: event.target.value })}
                    autoComplete="name"
                    maxLength={120}
                    required
                  />
                </label>
                <label>
                  Số điện thoại
                  <input
                    type="tel"
                    value={addressForm.phone}
                    onChange={(event) => setAddressForm({ ...addressForm, phone: event.target.value })}
                    autoComplete="tel"
                    maxLength={30}
                    required
                  />
                </label>
                {showAddressDetails ? (
                  <>
                    <label>
                      Tỉnh/Thành phố
                      {manualRegionEntry ? (
                        <input
                          value={addressForm.province}
                          onChange={(event) => setAddressForm({ ...addressForm, province: event.target.value })}
                          placeholder="Nhập tỉnh hoặc thành phố"
                          maxLength={120}
                          required
                        />
                      ) : (
                        <button
                          type="button"
                          className="store-address-region-field"
                          onClick={() => openRegionPicker('province')}
                          aria-label="Chọn lại tỉnh/thành phố"
                        >
                          <span>{addressForm.province || 'Chọn tỉnh/thành phố'}</span>
                          <span aria-hidden="true">›</span>
                        </button>
                      )}
                    </label>
                    <label>
                      Phường/Xã
                      {manualRegionEntry ? (
                        <input
                          value={addressForm.ward}
                          onChange={(event) => setAddressForm({ ...addressForm, ward: event.target.value })}
                          placeholder="Nhập phường hoặc xã"
                          maxLength={120}
                          required
                        />
                      ) : (
                        <button
                          type="button"
                          className="store-address-region-field"
                          onClick={() => openRegionPicker('ward')}
                          aria-label="Chọn lại phường/xã"
                        >
                          <span>{addressForm.ward || 'Chọn phường/xã'}</span>
                          <span aria-hidden="true">›</span>
                        </button>
                      )}
                    </label>
                    <button
                      type="button"
                      className="store-address-manual-entry"
                      onClick={() => setManualRegionEntry((current) => !current)}
                    >
                      {manualRegionEntry
                        ? 'Chọn tỉnh/thành, phường/xã từ danh sách'
                        : 'Không tìm thấy khu vực? Nhập thủ công'}
                    </button>
                    <label>
                      Số nhà, tên đường
                      <input
                        value={addressForm.street}
                        onChange={(event) => setAddressForm({ ...addressForm, street: event.target.value })}
                        placeholder="Nhập số nhà, tên đường"
                        autoComplete="street-address"
                        maxLength={240}
                        required
                      />
                    </label>
                    <label>
                      Chi tiết địa chỉ
                      <textarea
                        value={addressForm.detailAddress}
                        onChange={(event) => setAddressForm({ ...addressForm, detailAddress: event.target.value })}
                        placeholder="Tòa nhà, căn hộ, tầng, hướng dẫn giao hàng..."
                        maxLength={300}
                        rows={2}
                      />
                    </label>
                  </>
                ) : (
                  <button
                    type="button"
                    className="store-address-manual-entry"
                    onClick={() => setShowAddressDetails(true)}
                  >
                    Nhập địa chỉ thủ công
                  </button>
                )}
                {addressError && <p className="store-address-error" role="alert">{addressError}</p>}
                <footer className="store-address-modal-footer">
                  <button
                    type="button"
                    className="store-address-secondary"
                    onClick={() => setAddressFormOpen(false)}
                  >
                    Quay lại
                  </button>
                  <button type="submit" className="store-address-confirm" disabled={savingAddress}>
                    {savingAddress ? 'Đang lưu...' : 'Lưu địa chỉ'}
                  </button>
                </footer>
              </form>
            ) : (
              <>
                <div className="store-address-list">
                  {profileLoading ? (
                    <p className="store-address-empty">Đang tải địa chỉ...</p>
                  ) : savedAddresses.length === 0 ? (
                    <p className="store-address-empty">Bạn chưa lưu địa chỉ giao hàng nào.</p>
                  ) : (
                    savedAddresses.map((address) => (
                      <article className="store-address-item" key={address.id}>
                        <label className="store-address-choice">
                          <input
                            type="radio"
                            name="delivery-address"
                            checked={pendingAddressId === address.id}
                            onChange={() => setPendingAddressId(address.id)}
                          />
                          <span>
                            <strong>{address.name} · {address.phone}</strong>
                            <small>{address.address || formatAddress(address)}</small>
                            {address.id === defaultAddressId && (
                              <small className="store-address-default">Mặc định</small>
                            )}
                          </span>
                        </label>
                        <div className="store-address-actions">
                          {address.id !== defaultAddressId && !address.isLegacy && (
                            <button type="button" onClick={() => handleSetDefault(address)}>Đặt mặc định</button>
                          )}
                          <button type="button" onClick={() => openAddressForm(address)}>Sửa</button>
                          {!address.isLegacy && (
                            <button
                              type="button"
                              className="is-delete"
                              onClick={() => handleDeleteAddress(address)}
                            >
                              Xóa
                            </button>
                          )}
                        </div>
                      </article>
                    ))
                  )}
                  {addressError && <p className="store-address-error" role="alert">{addressError}</p>}
                  <button
                    type="button"
                    className="store-address-add"
                    onClick={() => openAddressForm()}
                  >
                    + Thêm thông tin địa chỉ giao hàng mới
                  </button>
                </div>
                <footer className="store-address-modal-footer">
                  <button
                    type="button"
                    className="store-address-secondary"
                    onClick={() => setAddressPickerOpen(false)}
                  >
                    Đóng
                  </button>
                  <button
                    type="button"
                    className="store-address-confirm"
                    disabled={!pendingAddress}
                    onClick={confirmAddress}
                  >
                    Xác nhận
                  </button>
                </footer>
              </>
            )}
          </section>
        </div>
      )}
      {regionPickerOpen && (
        <div
          className="store-region-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setRegionPickerOpen(false);
          }}
        >
          <section
            className="store-region-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="store-region-modal-title"
          >
            <header className="store-region-modal-header">
              <span aria-hidden="true" />
              <h2 id="store-region-modal-title">Chọn khu vực</h2>
              <button
                type="button"
                aria-label="Đóng chọn khu vực"
                onClick={() => setRegionPickerOpen(false)}
              >
                ×
              </button>
            </header>
            <div className="store-region-steps">
              <button
                type="button"
                className="store-region-back"
                aria-label={regionStep === 'ward' ? 'Quay lại chọn tỉnh/thành' : 'Quay lại nhập địa chỉ'}
                onClick={() => {
                  if (regionStep === 'ward') setRegionStep('province');
                  else setRegionPickerOpen(false);
                }}
              >
                ‹
              </button>
              <button
                type="button"
                className={regionStep === 'province' ? 'is-active' : ''}
                onClick={() => {
                  setRegionStep('province');
                  setRegionError('');
                }}
              >
                1. Tỉnh/TP
              </button>
              <span aria-hidden="true">›</span>
              <button
                type="button"
                className={regionStep === 'ward' ? 'is-active' : ''}
                disabled={!selectedProvinceCode}
                onClick={openWardStep}
              >
                2. Phường/Xã
              </button>
            </div>
            <div className="store-region-controls">
              <button
                type="button"
                className="store-address-current-location"
                onClick={handleUseCurrentLocation}
                disabled={locating}
              >
                {locating ? 'Đang lấy vị trí...' : '◎  Dùng vị trí hiện tại'}
              </button>
              <label className="store-region-search">
                <input
                  aria-label="Tìm khu vực"
                  value={regionSearch}
                  onChange={(event) => setRegionSearch(event.target.value)}
                  placeholder={regionStep === 'province'
                    ? 'Tìm tỉnh/thành phố'
                    : 'Tìm phường/xã'}
                />
              </label>
            </div>
            <div className="store-region-results">
              {regionLoading ? (
                <p>Đang tải danh sách khu vực...</p>
              ) : regionError ? (
                <p role="alert">{regionError}</p>
              ) : filteredRegionOptions.length === 0 ? (
                <p>Không tìm thấy khu vực phù hợp. Bạn có thể nhập thủ công.</p>
              ) : (
                filteredRegionOptions.map((option) => (
                  <button
                    type="button"
                    key={option.code}
                    onClick={() => (
                      regionStep === 'province'
                        ? chooseProvince(option)
                        : chooseWard(option)
                    )}
                  >
                    {option.name}
                  </button>
                ))
              )}
            </div>
            <p className="store-region-attribution">
              Danh sách khu vực từ{' '}
              <a href="https://provinces.open-api.vn/" target="_blank" rel="noreferrer">
                provinces.open-api.vn
              </a>
            </p>
          </section>
        </div>
      )}
    </section>
  );
};

export default DeliveryAddressPicker;
