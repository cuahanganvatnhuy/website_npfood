import { useEffect, useState } from 'react';
import {
  defaultPaymentSettings,
  loadPaymentSettings,
  savePaymentSettings
} from '../services/paymentSettingsService.js';
import '../css/PaymentSettings.css';

const MAX_QR_IMAGE_SIZE = 1024 * 1024;

const getPaymentSettingsError = (error) => {
  const errorDetails = `${error?.code || ''} ${error?.message || ''}`.toUpperCase();
  if (errorDetails.includes('PERMISSION_DENIED') || errorDetails.includes('PERMISSION DENIED')) {
    return 'Firebase chưa cho phép lưu cài đặt thanh toán. Hãy publish database.rules.json trong Firebase Console → Realtime Database → Rules.';
  }
  return error?.message || 'Không thể lưu cài đặt thanh toán.';
};

const PaymentSettings = () => {
  const [formData, setFormData] = useState(defaultPaymentSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    let active = true;
    loadPaymentSettings()
      .then((settings) => {
        if (active) setFormData(settings);
      })
      .catch((loadError) => {
        console.error('Không thể tải cài đặt thanh toán:', loadError);
        if (active) setError(getPaymentSettingsError(loadError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleImageChange = (event) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Chỉ chấp nhận ảnh PNG, JPG hoặc WebP.');
      return;
    }
    if (file.size > MAX_QR_IMAGE_SIZE) {
      setError('Ảnh QR cần có dung lượng tối đa 1 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        setError('Không thể đọc nội dung ảnh QR.');
        return;
      }
      setFormData((current) => ({ ...current, qrImageUrl: reader.result }));
      setError('');
      setStatus('');
    };
    reader.onerror = () => setError('Không thể đọc tệp hình ảnh.');
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setStatus('');
    setSaving(true);
    try {
      const savedSettings = await savePaymentSettings(formData);
      setFormData(savedSettings);
      setStatus('Đã lưu cài đặt thanh toán MoMo.');
    } catch (saveError) {
      console.error('Không thể lưu cài đặt thanh toán:', saveError);
      setError(getPaymentSettingsError(saveError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="payment-settings-container">
      <div className="payment-settings-page">
        <header className="payment-settings-heading">
          <div>
            <span className="payment-settings-eyebrow">THANH TOÁN CỬA HÀNG</span>
            <h2>Cài đặt thanh toán</h2>
            <p>Tải QR MoMo của cửa hàng lên và bật lựa chọn này tại trang đặt hàng.</p>
          </div>
          <span className="payment-settings-heading-icon" aria-hidden="true">▦</span>
        </header>

        <form className="payment-settings-card" onSubmit={handleSubmit}>
          <div className="payment-settings-card-heading">
            <div>
              <h3>Thanh toán MoMo qua QR</h3>
              <p>Khách xem số tiền và nội dung chuyển khoản sau khi tạo đơn.</p>
            </div>
            <span className={`payment-settings-state ${formData.enabled ? 'enabled' : ''}`}>
              {formData.enabled ? 'Đang bật' : 'Đang tắt'}
            </span>
          </div>

          <div className="payment-settings-body">
            <label className="payment-settings-toggle">
              <input
                type="checkbox"
                checked={formData.enabled}
                onChange={(event) => {
                  setFormData((current) => ({ ...current, enabled: event.target.checked }));
                  setError('');
                  setStatus('');
                }}
                disabled={loading || saving}
              />
              <span>
                <strong>Hiển thị MoMo tại trang thanh toán</strong>
                <small>Khách vẫn có thể chọn thanh toán khi nhận hàng.</small>
              </span>
            </label>

            <div className="payment-settings-upload">
              <div>
                <strong>Ảnh QR MoMo</strong>
                <small>Ảnh PNG, JPG hoặc WebP, tối đa 1 MB. Ảnh sẽ được công khai để khách xem.</small>
              </div>
              <label className="payment-settings-upload-button">
                {formData.qrImageUrl ? 'Đổi ảnh QR' : 'Tải ảnh QR lên'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleImageChange}
                  disabled={loading || saving}
                />
              </label>
            </div>

            {formData.qrImageUrl ? (
              <div className="payment-settings-preview">
                <img src={formData.qrImageUrl} alt="Xem trước mã QR MoMo" />
                <button
                  type="button"
                  onClick={() => {
                    setFormData((current) => ({ ...current, qrImageUrl: '' }));
                    setError('');
                    setStatus('');
                  }}
                  disabled={loading || saving}
                >
                  Xóa ảnh
                </button>
              </div>
            ) : (
              <div className="payment-settings-placeholder">Chưa tải ảnh QR lên</div>
            )}

            <p className="payment-settings-info">
              Đây là QR tĩnh: khách sẽ tự nhập số tiền nếu MoMo không điền sẵn. Cửa hàng cần kiểm tra giao dịch và xác nhận đã thanh toán trong trang Đơn hàng.
            </p>
          </div>

          <footer className="payment-settings-footer">
            {loading && <p role="status">Đang tải cài đặt…</p>}
            {error && <p className="payment-settings-error" role="alert">{error}</p>}
            {status && <p className="payment-settings-success" role="status">{status}</p>}
            <button type="submit" disabled={loading || saving}>
              {saving ? 'Đang lưu…' : 'Lưu cài đặt thanh toán'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default PaymentSettings;
