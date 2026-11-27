import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  defaultAdminEmailNotificationSettings,
  defaultAdminNotificationSettings,
  loadAdminEmailNotificationSettings,
  saveAdminEmailNotificationSettings,
  saveAdminNotificationSettings,
  sendAdminEmailTest
} from '../services/adminNotificationService.js';
import '../css/Settings.css';

const notificationOptions = [
  {
    key: 'orders',
    icon: '🧾',
    title: 'Đơn hàng mới',
    description: 'Báo khi khách hàng vừa đặt một đơn hàng.'
  },
  {
    key: 'contactMessages',
    icon: '✉️',
    title: 'Tin nhắn liên hệ',
    description: 'Báo khi khách gửi tin nhắn qua trang Liên hệ.'
  },
  {
    key: 'chatMessages',
    icon: '💬',
    title: 'Tin nhắn chat',
    description: 'Báo khi khách gửi tin nhắn trong cửa sổ chat.'
  },
  {
    key: 'lowStock',
    icon: '📦',
    title: 'Cảnh báo tồn kho',
    description: 'Báo khi tồn kho của sản phẩm giảm xuống còn 5 hoặc ít hơn.'
  }
];
const emailNotificationOptions = notificationOptions.filter(({ key }) => ['orders', 'chatMessages'].includes(key));

const getEmailSettingsErrorMessage = (error, fallbackMessage) => {
  const errorDetails = `${error?.code || ''} ${error?.message || ''}`.toUpperCase();
  if (errorDetails.includes('PERMISSION_DENIED') || errorDetails.includes('PERMISSION DENIED')) {
    return 'Firebase chưa cho phép lưu cài đặt. Hãy đăng nhập bằng admin@gmail.com rồi publish database.rules.json trong Firebase Console → Realtime Database → Rules.';
  }
  return error?.message || fallbackMessage;
};

const Settings = () => {
  const { notificationSettings, setNotificationSettings } = useOutletContext();
  const [formData, setFormData] = useState(notificationSettings || defaultAdminNotificationSettings);
  const [emailFormData, setEmailFormData] = useState(defaultAdminEmailNotificationSettings);
  const [savedEmailFormData, setSavedEmailFormData] = useState(defaultAdminEmailNotificationSettings);
  const [emailLoading, setEmailLoading] = useState(true);
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailTesting, setEmailTesting] = useState(false);
  const [emailDirty, setEmailDirty] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailStatus, setEmailStatus] = useState('');
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    setFormData(notificationSettings || defaultAdminNotificationSettings);
  }, [notificationSettings]);

  useEffect(() => {
    let active = true;
    loadAdminEmailNotificationSettings()
      .then((settings) => {
        if (!active) return;
        setEmailFormData(settings);
        setSavedEmailFormData(settings);
      })
      .catch((error) => {
        console.error('Không thể tải cài đặt Gmail:', error);
        if (active) {
          setEmailError(getEmailSettingsErrorMessage(
            error,
            'Không thể tải cài đặt Gmail. Hãy kiểm tra quyền quản trị và kết nối Firebase.'
          ));
        }
      })
      .finally(() => {
        if (active) setEmailLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = (event) => {
    event.preventDefault();
    setSaveError('');
    setSaved(false);
    try {
      saveAdminNotificationSettings(formData);
      setNotificationSettings(formData);
      setSaved(true);
    } catch (error) {
      console.error('Không thể lưu cài đặt thông báo:', error);
      setSaveError(error.message || 'Không thể lưu cài đặt trên trình duyệt này.');
    }
  };

  const updateEmailFormData = (key, value) => {
    setEmailFormData((current) => ({ ...current, [key]: value }));
    setEmailDirty(true);
    setEmailError('');
    setEmailStatus('');
  };

  const handleEmailSubmit = async (event) => {
    event.preventDefault();
    setEmailError('');
    setEmailStatus('');
    setEmailSaving(true);
    const nextSettings = {
      ...emailFormData,
      recipientEmail: emailFormData.recipientEmail.trim(),
      appsScriptUrl: emailFormData.appsScriptUrl.trim()
    };

    try {
      await saveAdminEmailNotificationSettings(nextSettings);
      setEmailFormData(nextSettings);
      setSavedEmailFormData(nextSettings);
      setEmailDirty(false);
      setEmailStatus('Đã lưu cài đặt và gửi yêu cầu đồng bộ đến Apps Script.');
    } catch (error) {
      console.error('Không thể lưu cài đặt Gmail:', error);
      setEmailError(getEmailSettingsErrorMessage(error, 'Không thể lưu cài đặt Gmail.'));
    } finally {
      setEmailSaving(false);
    }
  };

  const handleEmailReset = () => {
    setEmailFormData(savedEmailFormData);
    setEmailDirty(false);
    setEmailError('');
    setEmailStatus('');
  };

  const handleSendTestEmail = async () => {
    setEmailError('');
    setEmailStatus('');
    setEmailTesting(true);
    try {
      await sendAdminEmailTest(savedEmailFormData);
      setEmailStatus(`Đã gửi yêu cầu email thử đến ${savedEmailFormData.recipientEmail}. Hãy kiểm tra hộp thư.`);
    } catch (error) {
      console.error('Không thể gửi email kiểm tra:', error);
      setEmailError(error.message || 'Không gửi được yêu cầu email thử. Hãy kiểm tra URL Apps Script.');
    } finally {
      setEmailTesting(false);
    }
  };

  return (
    <div className="admin-settings-container">
      <div className="admin-settings-page">
        <div className="admin-settings-heading">
          <div>
            <span className="admin-settings-eyebrow">TÙY CHỈNH QUẢN TRỊ</span>
            <h2>Cài đặt thông báo</h2>
            <p>Chọn sự kiện nhận trong trang quản trị và cấu hình gửi Gmail qua Apps Script.</p>
          </div>
          <span className="admin-settings-heading-icon" aria-hidden="true">⚙</span>
        </div>

        <div className="admin-settings-email-note">
          <span className="admin-settings-note-icon" aria-hidden="true">✉</span>
          <div>
            <strong>Gửi email không cần nâng cấp Firebase</strong>
            <p>Apps Script gửi email khi khách đặt hàng hoặc gửi tin nhắn chat, bằng tài khoản Google triển khai script. Không cần Gmail App Password hoặc Firebase Blaze.</p>
          </div>
          <span className="admin-settings-server-badge">APPS SCRIPT</span>
        </div>

        <form className="admin-settings-card admin-settings-email-card" onSubmit={handleEmailSubmit}>
          <div className="admin-settings-card-heading">
            <div>
              <h3>Cài đặt gửi Gmail</h3>
              <p>Bật email đơn hàng, tin nhắn chat và chọn địa chỉ nhận.</p>
            </div>
            <span className="admin-settings-card-count">Google Apps Script</span>
          </div>

          <div className="admin-settings-email-fields">
            <label htmlFor="admin-notification-email">Gmail nhận thông báo</label>
            <input
              id="admin-notification-email"
              type="email"
              autoComplete="email"
              placeholder="ten@gmail.com"
              value={emailFormData.recipientEmail}
              onChange={(event) => updateEmailFormData('recipientEmail', event.target.value)}
              required={emailFormData.enabled}
              disabled={emailLoading}
            />
            <small>Email người nhận có thể khác với tài khoản Gmail dùng để gửi.</small>

            <label htmlFor="admin-apps-script-url">URL Web App Apps Script</label>
            <input
              id="admin-apps-script-url"
              type="url"
              autoComplete="url"
              placeholder="https://script.google.com/macros/s/.../exec"
              value={emailFormData.appsScriptUrl}
              onChange={(event) => updateEmailFormData('appsScriptUrl', event.target.value)}
              required={emailFormData.enabled}
              disabled={emailLoading}
            />
            <small>Triển khai Apps Script dưới dạng Web App, chọn chạy bằng tài khoản của bạn và quyền truy cập “Bất kỳ ai”.</small>

            <label className="admin-settings-email-enabled">
              <input
                type="checkbox"
                checked={emailFormData.enabled}
                onChange={(event) => updateEmailFormData('enabled', event.target.checked)}
                disabled={emailLoading}
              />
              <span>
                <strong>Bật gửi thông báo qua Gmail</strong>
                <small>Email sẽ được gửi theo các sự kiện được chọn bên dưới.</small>
              </span>
            </label>
          </div>

          <div className="admin-settings-card-heading admin-settings-email-events-heading">
            <div>
              <h3>Sự kiện gửi email</h3>
              <p>Các sự kiện này độc lập với thông báo trong chuông.</p>
            </div>
          </div>

          <div className="admin-settings-options">
            {emailNotificationOptions.map((option) => (
              <label className="admin-settings-option" key={option.key}>
                <span className="admin-settings-option-icon" aria-hidden="true">{option.icon}</span>
                <span className="admin-settings-option-copy">
                  <strong>{option.title}</strong>
                  <small>{option.description}</small>
                </span>
                <input
                  type="checkbox"
                  checked={Boolean(emailFormData[option.key])}
                  onChange={(event) => updateEmailFormData(option.key, event.target.checked)}
                  aria-label={`Gửi Gmail: ${option.title}`}
                  disabled={emailLoading}
                />
              </label>
            ))}
          </div>

          <div className="admin-settings-footer">
            <p className="admin-settings-storage-note">
              {emailLoading ? 'Đang tải cài đặt…' : 'Cài đặt Gmail lưu trong Firebase; Apps Script xử lý email đơn hàng và tin nhắn chat.'}
            </p>
            {emailError && <p className="admin-settings-error" role="alert">{emailError}</p>}
            {emailStatus && <p className="admin-settings-success" role="status">{emailStatus}</p>}
            <div className="admin-settings-actions">
              <button
                type="button"
                className="admin-settings-reset"
                onClick={handleEmailReset}
                disabled={emailLoading || emailSaving || !emailDirty}
              >
                Hủy thay đổi
              </button>
              <button
                type="button"
                className="admin-settings-test"
                onClick={handleSendTestEmail}
                disabled={emailLoading || emailSaving || emailTesting || emailDirty || !savedEmailFormData.recipientEmail || !savedEmailFormData.appsScriptUrl}
              >
                {emailTesting ? 'Đang gửi…' : 'Gửi email thử'}
              </button>
              <button type="submit" className="admin-settings-save" disabled={emailLoading || emailSaving}>
                {emailSaving ? 'Đang lưu…' : 'Lưu cài đặt Gmail'}
              </button>
            </div>
          </div>
        </form>

        <form className="admin-settings-card" onSubmit={handleSubmit}>
          <div className="admin-settings-card-heading">
            <div>
              <h3>Thông báo trong trang quản trị</h3>
              <p>Bật hoặc tắt từng loại thông báo trong chuông.</p>
            </div>
            <span className="admin-settings-card-count">
              {Object.values(formData).filter(Boolean).length}/{notificationOptions.length} đang bật
            </span>
          </div>

          <div className="admin-settings-options">
            {notificationOptions.map((option) => (
              <label className="admin-settings-option" key={option.key}>
                <span className="admin-settings-option-icon" aria-hidden="true">{option.icon}</span>
                <span className="admin-settings-option-copy">
                  <strong>{option.title}</strong>
                  <small>{option.description}</small>
                </span>
                <input
                  type="checkbox"
                  checked={Boolean(formData[option.key])}
                  onChange={(event) => setFormData((current) => ({
                    ...current,
                    [option.key]: event.target.checked
                  }))}
                  aria-label={option.title}
                />
              </label>
            ))}
          </div>

          <div className="admin-settings-footer">
            <p className="admin-settings-storage-note">Cài đặt chuông được lưu trên trình duyệt này.</p>
            {saveError && <p className="admin-settings-error" role="alert">{saveError}</p>}
            {saved && <p className="admin-settings-success" role="status">Đã lưu cài đặt thông báo.</p>}
            <div className="admin-settings-actions">
              <button type="button" className="admin-settings-reset" onClick={() => setFormData(notificationSettings)}>
                Hủy thay đổi
              </button>
              <button type="submit" className="admin-settings-save">Lưu cài đặt</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Settings;
