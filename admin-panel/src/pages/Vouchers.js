import { useEffect, useState } from 'react';
import {
  deleteVoucher,
  getAllVouchers,
  getLoyaltySettings,
  hideVoucher,
  saveVoucher
} from '../services/promotionService.js';
import CurrencyInput from '../components/CurrencyInput.js';
import LoadingSpinner from '../components/LoadingSpinner.js';
import '../css/Promotions.css';

const emptyVoucher = {
  name: '',
  code: '',
  discountType: 'percent',
  discountValue: '',
  audienceType: 'all',
  targetTier: '',
  minOrder: '0',
  usageLimit: '0',
  startsAt: '',
  expiresAt: '',
  isActive: true
};

const toDateTimeInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

const toIsoDate = (value) => value ? new Date(value).toISOString() : '';

const formatDate = (value) => {
  if (!value) return 'Không giới hạn';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Không hợp lệ' : date.toLocaleDateString('vi-VN');
};

const Vouchers = () => {
  const [vouchers, setVouchers] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [createChoiceOpen, setCreateChoiceOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState(emptyVoucher);
  const [saving, setSaving] = useState(false);

  const fetchVouchers = async () => {
    setLoading(true);
    setError('');
    try {
      const [voucherData, loyaltySettings] = await Promise.all([
        getAllVouchers(),
        getLoyaltySettings()
      ]);
      setVouchers(voucherData);
      setTiers(Array.isArray(loyaltySettings.tiers)
        ? loyaltySettings.tiers.filter((tier) => String(tier.name || '').trim())
        : []);
    } catch (fetchError) {
      console.error('Lỗi khi tải voucher:', fetchError);
      setError('Không thể tải danh sách voucher. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVouchers();
  }, []);

  const openNewVoucher = () => {
    setCreateChoiceOpen(true);
  };

  const openVoucherForm = (audienceType) => {
    setEditingId('');
    setForm({
      ...emptyVoucher,
      audienceType,
      targetTier: audienceType === 'tier' ? tiers[0]?.name || '' : ''
    });
    setCreateChoiceOpen(false);
    setModalOpen(true);
  };

  const openEditVoucher = (voucher) => {
    setEditingId(voucher.id);
    setForm({
      name: voucher.name || '',
      code: voucher.code || '',
      discountType: voucher.discountType || 'percent',
      discountValue: String(voucher.discountValue ?? ''),
      audienceType: voucher.audienceType === 'tier' ? 'tier' : 'all',
      targetTier: voucher.targetTier || '',
      minOrder: String(voucher.minOrder || 0),
      usageLimit: String(voucher.usageLimit || 0),
      startsAt: toDateTimeInput(voucher.startsAt),
      expiresAt: toDateTimeInput(voucher.expiresAt),
      isActive: voucher.isActive !== false
    });
    setModalOpen(true);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    const discountValue = Number(form.discountValue);
    if (discountValue <= 0 || (form.discountType === 'percent' && discountValue > 100)) {
      alert(form.discountType === 'percent'
        ? 'Phần trăm giảm phải lớn hơn 0 và không vượt quá 100%.'
        : 'Số tiền giảm phải lớn hơn 0.');
      return;
    }
    if (form.startsAt && form.expiresAt && new Date(form.startsAt) >= new Date(form.expiresAt)) {
      alert('Ngày kết thúc phải sau ngày bắt đầu.');
      return;
    }
    if (form.audienceType === 'tier' && !form.targetTier) {
      alert('Chọn hạng thành viên được sử dụng voucher này.');
      return;
    }

    setSaving(true);
    try {
      await saveVoucher({
        ...form,
        discountValue,
        minOrder: Number(form.minOrder) || 0,
        usageLimit: Number(form.usageLimit) || 0,
        startsAt: toIsoDate(form.startsAt),
        expiresAt: toIsoDate(form.expiresAt)
      }, editingId);
      setModalOpen(false);
      await fetchVouchers();
    } catch (saveError) {
      console.error('Lỗi khi lưu voucher:', saveError);
      alert(`Lưu voucher thất bại: ${saveError.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (voucher) => {
    try {
      await saveVoucher({ ...voucher, isActive: voucher.isActive === false }, voucher.id);
      await fetchVouchers();
    } catch (updateError) {
      console.error('Lỗi khi cập nhật voucher:', updateError);
      alert(`Cập nhật voucher thất bại: ${updateError.message}`);
    }
  };

  const handleHide = async (voucher) => {
    if (!window.confirm(`Ẩn mã ${voucher.code}? Lịch sử sử dụng sẽ được giữ lại.`)) return;
    try {
      await hideVoucher(voucher.id);
      await fetchVouchers();
    } catch (deleteError) {
      console.error('Lỗi khi ẩn voucher:', deleteError);
      alert(`Ẩn voucher thất bại: ${deleteError.message}`);
    }
  };

  const handleDelete = async (voucher) => {
    if (!window.confirm(`Xóa vĩnh viễn voucher ${voucher.code}? Thao tác này không thể hoàn tác.`)) return;
    try {
      await deleteVoucher(voucher.id);
      await fetchVouchers();
    } catch (deleteError) {
      console.error('Lỗi khi xóa voucher:', deleteError);
      alert(`Xóa voucher thất bại: ${deleteError.message}`);
    }
  };

  const activeCount = vouchers.filter((voucher) => voucher.isActive !== false).length;
  const totalUses = vouchers.reduce((sum, voucher) => sum + (Number(voucher.usedCount) || 0), 0);

  return (
    <div className="promotions-page">
      <header className="promotion-page-heading">
        <div>
          <span className="promotion-eyebrow">MARKETING & ƯU ĐÃI</span>
          <h2>Quản lý voucher</h2>
          <p>Tạo mã giảm giá và thiết lập điều kiện áp dụng cho khách hàng.</p>
        </div>
        <button type="button" className="promotion-primary-button" onClick={openNewVoucher}>
          <span aria-hidden="true">＋</span> Tạo voucher
        </button>
      </header>

      <div className="promotion-stats">
        <article><span>🎟</span><div><small>Tổng mã voucher</small><strong>{vouchers.length}</strong></div></article>
        <article><span>✓</span><div><small>Đang hoạt động</small><strong>{activeCount}</strong></div></article>
        <article><span>↗</span><div><small>Lượt đã sử dụng</small><strong>{totalUses}</strong></div></article>
      </div>

      <section className="promotion-card">
        <div className="promotion-card-heading">
          <div><h3>Danh sách voucher</h3><p>Voucher sẽ được kiểm tra ngày, đơn tối thiểu và lượt dùng khi khách áp mã.</p></div>
          <button type="button" className="promotion-secondary-button" onClick={fetchVouchers} disabled={loading}>↻ Làm mới</button>
        </div>

        {loading ? (
          <div className="promotion-state"><LoadingSpinner message="Đang tải voucher..." inline /></div>
        ) : error ? (
          <div className="promotion-state promotion-error"><strong>{error}</strong><button type="button" onClick={fetchVouchers}>Thử lại</button></div>
        ) : vouchers.length === 0 ? (
          <div className="promotion-state"><span aria-hidden="true">🎟</span><strong>Chưa có voucher</strong><p>Tạo mã đầu tiên để bắt đầu chương trình ưu đãi.</p><button type="button" className="promotion-primary-button" onClick={openNewVoucher}>Tạo voucher</button></div>
        ) : (
          <div className="promotion-table-scroll">
            <table className="promotion-table">
              <thead><tr><th>Mã / chương trình</th><th>Mức giảm</th><th>Đối tượng</th><th>Đơn tối thiểu</th><th>Lượt dùng</th><th>Thời hạn</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
              <tbody>
                {vouchers.map((voucher) => {
                  const expired = voucher.expiresAt && new Date(voucher.expiresAt) < new Date();
                  const limit = Number(voucher.usageLimit) || 0;
                  return (
                    <tr key={voucher.id}>
                      <td><div className="voucher-code-cell"><strong className="voucher-code">{voucher.code}</strong><small>{voucher.name || 'Ưu đãi khách hàng'}</small></div></td>
                      <td><strong className="voucher-discount">{Number(voucher.discountValue).toLocaleString('vi-VN')}{voucher.discountType === 'percent' ? '%' : ' ₫'}</strong></td>
                      <td><span className="voucher-audience">{voucher.audienceType === 'tier' ? `Hạng ${voucher.targetTier || 'chưa chọn'}` : 'Tất cả khách hàng'}</span></td>
                      <td>{Number(voucher.minOrder) > 0 ? `${Number(voucher.minOrder).toLocaleString('vi-VN')} ₫` : 'Không yêu cầu'}</td>
                      <td>{Number(voucher.usedCount) || 0} / {limit || '∞'}</td>
                      <td>{formatDate(voucher.expiresAt)}</td>
                      <td><span className={`voucher-status ${voucher.isActive === false || expired ? 'inactive' : ''}`}>{expired ? 'Hết hạn' : voucher.isActive === false ? 'Đã ẩn' : 'Đang bật'}</span></td>
                      <td><div className="voucher-actions">
                        <button type="button" onClick={() => openEditVoucher(voucher)}>Sửa</button>
                        <button type="button" onClick={() => handleToggleActive(voucher)}>{voucher.isActive === false ? 'Hiện' : 'Tắt'}</button>
                        <button type="button" className="danger" onClick={() => handleHide(voucher)}>Ẩn</button>
                        <button type="button" className="permanent-delete" onClick={() => handleDelete(voucher)}>Xóa</button>
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {createChoiceOpen && (
        <div className="promotion-modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setCreateChoiceOpen(false);
        }}>
          <section className="promotion-modal voucher-choice-modal" role="dialog" aria-modal="true" aria-labelledby="voucher-choice-title">
            <header>
              <div><span className="promotion-eyebrow">TẠO CHƯƠNG TRÌNH ƯU ĐÃI</span><h3 id="voucher-choice-title">Bạn muốn tạo loại voucher nào?</h3></div>
              <button type="button" onClick={() => setCreateChoiceOpen(false)} aria-label="Đóng">×</button>
            </header>
            <div className="voucher-choice-options">
              <button type="button" className="voucher-choice-option" onClick={() => openVoucherForm('all')}>
                <span aria-hidden="true">🎟</span>
                <strong>Voucher mới</strong>
                <small>Dành cho tất cả khách hàng, tạo điều kiện giảm giá như bình thường.</small>
              </button>
              <button type="button" className="voucher-choice-option" onClick={() => openVoucherForm('tier')} disabled={tiers.length === 0}>
                <span aria-hidden="true">★</span>
                <strong>Voucher theo hạng</strong>
                <small>Chọn hạng thành viên được áp dụng voucher này.</small>
              </button>
              {tiers.length === 0 && <p className="voucher-choice-hint">Chưa có hạng thành viên. Hãy tạo hạng trong trang Tích điểm &amp; hạng trước.</p>}
            </div>
            <footer className="voucher-choice-footer">
              <button type="button" className="promotion-secondary-button" onClick={() => setCreateChoiceOpen(false)}>Hủy</button>
            </footer>
          </section>
        </div>
      )}

      {modalOpen && (
        <div className="promotion-modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setModalOpen(false);
        }}>
          <section className="promotion-modal" role="dialog" aria-modal="true" aria-labelledby="voucher-modal-title">
            <header><div><span className="promotion-eyebrow">MÃ ƯU ĐÃI</span><h3 id="voucher-modal-title">{editingId ? 'Chỉnh sửa voucher' : 'Tạo voucher mới'}</h3></div><button type="button" onClick={() => setModalOpen(false)} aria-label="Đóng">×</button></header>
            <form onSubmit={handleSave}>
              <div className="promotion-form-grid">
                <label className="full">Tên chương trình<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ví dụ: Ưu đãi khách mới" required /></label>
                <label>Mã voucher<input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} placeholder="NPFOOD10" maxLength={30} required /></label>
                <label>Loại giảm giá<select value={form.discountType} onChange={(event) => setForm({ ...form, discountType: event.target.value })}><option value="percent">Phần trăm (%)</option><option value="fixed">Số tiền cố định (₫)</option></select></label>
                <label className="full">Đối tượng sử dụng<select value={form.audienceType} onChange={(event) => setForm({
                  ...form,
                  audienceType: event.target.value,
                  targetTier: event.target.value === 'tier' ? form.targetTier || tiers[0]?.name || '' : ''
                })}><option value="all">Voucher mới — tất cả khách hàng</option><option value="tier">Voucher theo hạng thành viên</option></select></label>
                {form.audienceType === 'tier' && (
                  <label className="full">Hạng được sử dụng
                    <select value={form.targetTier} onChange={(event) => setForm({ ...form, targetTier: event.target.value })} required>
                      <option value="">Chọn hạng thành viên</option>
                      {form.targetTier && !tiers.some((tier) => tier.name === form.targetTier) && (
                        <option value={form.targetTier}>{form.targetTier} (hạng hiện không còn trong cấu hình)</option>
                      )}
                      {tiers.map((tier) => <option key={tier.name} value={tier.name}>{tier.name}</option>)}
                    </select>
                  </label>
                )}
                <label>Mức giảm{form.discountType === 'fixed' ? (
                  <CurrencyInput value={form.discountValue} onValueChange={(value) => setForm({ ...form, discountValue: value })} required />
                ) : (
                  <input type="number" min="1" max="100" value={form.discountValue} onChange={(event) => setForm({ ...form, discountValue: event.target.value })} required />
                )}</label>
                <label>Đơn hàng tối thiểu (₫)<CurrencyInput value={form.minOrder} onValueChange={(value) => setForm({ ...form, minOrder: value })} /></label>
                <label>Giới hạn lượt dùng<input type="number" min="0" value={form.usageLimit} onChange={(event) => setForm({ ...form, usageLimit: event.target.value })} /><small>Để 0 nếu không giới hạn</small></label>
                <label>Bắt đầu<input type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} /></label>
                <label>Ngày hết hạn<input type="datetime-local" value={form.expiresAt} onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} /></label>
                <label className="promotion-checkbox full"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} /> Cho phép khách sử dụng voucher này</label>
              </div>
              <footer><button type="submit" className="promotion-primary-button" disabled={saving}>{saving ? 'Đang lưu...' : editingId ? 'Lưu thay đổi' : 'Tạo voucher'}</button><button type="button" className="promotion-secondary-button" onClick={() => setModalOpen(false)}>Hủy</button></footer>
            </form>
          </section>
        </div>
      )}
    </div>
  );
};

export default Vouchers;
