import { useEffect, useState } from 'react';
import { getLoyaltySettings, saveLoyaltySettings } from '../services/promotionService.js';
import { loyaltyTierNames } from '../services/loyaltyTierNames.js';
import CurrencyInput from '../components/CurrencyInput.js';
import LoadingSpinner from '../components/LoadingSpinner.js';
import '../css/LoyaltySettings.css';

const initialSettings = {
  amountPerPoint: 1000,
  pointsPerAmount: 1,
  tiers: loyaltyTierNames.map((name, index) => ({ name, minPoints: index === 0 ? 0 : '' }))
};

const LoyaltySettings = () => {
  const [settings, setSettings] = useState(initialSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const fetchSettings = async () => {
    setLoading(true);
    setError('');
    try {
      const currentSettings = await getLoyaltySettings();
      const savedTiers = Array.isArray(currentSettings.tiers)
        ? [...currentSettings.tiers].sort((a, b) => Number(a.minPoints || 0) - Number(b.minPoints || 0))
        : [];
      setSettings({
        ...initialSettings,
        ...currentSettings,
        tiers: loyaltyTierNames.map((name, index) => ({
          name,
          minPoints: index === 0 ? 0 : savedTiers[index]?.minPoints ?? ''
        }))
      });
    } catch (fetchError) {
      console.error('Lỗi khi tải cấu hình thành viên:', fetchError);
      setError('Không thể tải cấu hình tích điểm. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const updateTierMinimum = (index, value) => {
    setSettings((current) => ({
      ...current,
      tiers: current.tiers.map((tier, tierIndex) => tierIndex === index
        ? { ...tier, minPoints: value }
        : tier)
    }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const savedSettings = await saveLoyaltySettings(settings);
      setSettings((current) => ({ ...current, ...savedSettings }));
      setNotice('Đã lưu cấu hình điểm thưởng và hạng thành viên.');
    } catch (saveError) {
      console.error('Lỗi khi lưu cấu hình thành viên:', saveError);
      setError(saveError.message || 'Không thể lưu cấu hình. Vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  const sampleSpend = 25000;
  const amountPerPoint = Math.max(1, Number(settings.amountPerPoint) || 1);
  const pointsPerAmount = Math.max(1, Number(settings.pointsPerAmount) || 1);
  const samplePoints = Math.floor(sampleSpend / amountPerPoint) * pointsPerAmount;
  const sampleRemainder = sampleSpend % amountPerPoint;

  if (loading) {
    return <div className="loyalty-page"><div className="loyalty-state"><LoadingSpinner message="Đang tải cấu hình..." inline /></div></div>;
  }

  return (
    <div className="loyalty-page">
      <header className="loyalty-page-heading">
        <div>
          <span className="loyalty-eyebrow">CHƯƠNG TRÌNH KHÁCH HÀNG THÂN THIẾT</span>
          <h2>Tích điểm & hạng thành viên</h2>
          <p>Thiết lập cách cộng điểm và mốc điểm cho từng hạng khách hàng.</p>
        </div>
        <span className="loyalty-heading-icon" aria-hidden="true">★</span>
      </header>

      <form className="loyalty-settings-form" onSubmit={handleSave}>
        <section className="loyalty-settings-card">
          <div className="loyalty-card-heading"><span>01</span><div><h3>Quy tắc tích điểm</h3><p>Chi tiêu được cộng dồn; điểm tự động cộng khi đơn giao thành công. Đơn cũ được rà soát tự động ở trang Quản lý tài khoản khách.</p></div></div>
          <div className="loyalty-rate-fields">
            <label>Mỗi <span className="loyalty-input-with-suffix"><CurrencyInput value={settings.amountPerPoint} onValueChange={(value) => setSettings({ ...settings, amountPerPoint: value })} required /><b>₫</b></span> chi tiêu được</label>
            <label><span className="loyalty-input-with-suffix"><input type="number" min="1" value={settings.pointsPerAmount} onChange={(event) => setSettings({ ...settings, pointsPerAmount: event.target.value })} required /><b>điểm</b></span></label>
          </div>
          <div className="loyalty-example"><span aria-hidden="true">ⓘ</span><p>Ví dụ: chi tiêu lũy kế 25.000 ₫ được cộng <strong>{samplePoints} điểm</strong>; {sampleRemainder.toLocaleString('vi-VN')} ₫ còn lại sẽ chuyển sang đơn tiếp theo.</p></div>
        </section>

        <section className="loyalty-settings-card">
          <div className="loyalty-card-heading">
            <span>02</span>
            <div><h3>Hạng thành viên</h3><p>Nhập mốc điểm cho các hạng; tên hạng được cố định.</p></div>
          </div>
          <div className="loyalty-tier-list">
            {settings.tiers.map((tier, index) => (
              <article className="loyalty-tier-row" key={`${index}-${tier.name}`}>
                <span className="loyalty-tier-number">{String(index + 1).padStart(2, '0')}</span>
                <strong className="loyalty-tier-name">{tier.name}</strong>
                <label>
                  Mốc điểm tối thiểu
                  <input
                    type="number"
                    min={index === 0 ? 0 : 1}
                    step="1"
                    value={tier.minPoints}
                    onChange={(event) => updateTierMinimum(index, event.target.value)}
                    readOnly={index === 0}
                    required
                  />
                </label>
              </article>
            ))}
          </div>
          <p className="loyalty-tier-hint">Hạng Đồng bắt đầu từ 0 điểm. Nhập mốc tăng dần cho Bạc, Vàng và Kim cương.</p>
        </section>

        {error && <p className="loyalty-feedback error" role="alert">{error}</p>}
        {notice && <p className="loyalty-feedback success" role="status">{notice}</p>}
        <div className="loyalty-form-actions">
          <button type="submit" className="loyalty-save-button" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu cấu hình'}</button>
          <button type="button" className="loyalty-refresh-button" onClick={fetchSettings} disabled={saving}>Tải lại</button>
        </div>
      </form>
    </div>
  );
};

export default LoyaltySettings;
