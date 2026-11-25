import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  claimCustomerVoucher,
  getAvailableVouchers,
  getCustomerVoucherClaims
} from '../services/dataService';
import { getCustomerProfile } from '../services/customerAuthService';
import '../css/Vouchers.css';

const formatMoney = (value) => `${Number(value || 0).toLocaleString('vi-VN')} ₫`;
const VOUCHERS_PER_PAGE = 10;

const formatExpiry = (value) => {
  if (!value) return 'Không giới hạn thời gian';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Thời hạn không xác định'
    : `Hạn đến ${date.toLocaleDateString('vi-VN')}`;
};

const Vouchers = ({ user }) => {
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [customerProfile, setCustomerProfile] = useState(null);
  const [claimedVoucherIds, setClaimedVoucherIds] = useState(new Set());
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimingVoucherId, setClaimingVoucherId] = useState('');
  const [claimError, setClaimError] = useState('');
  const [claimNotice, setClaimNotice] = useState('');
  const [voucherPage, setVoucherPage] = useState(0);

  const fetchVouchers = async () => {
    setLoading(true);
    setError('');
    try {
      setVouchers(await getAvailableVouchers());
    } catch (fetchError) {
      console.error('Không thể tải voucher:', fetchError);
      setError('Không thể tải danh sách voucher. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVouchers();
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      setCustomerProfile(null);
      setClaimedVoucherIds(new Set());
      setClaimLoading(false);
      return undefined;
    }

    let active = true;
    setClaimLoading(true);
    setClaimError('');
    Promise.all([
      getCustomerProfile(user.uid),
      getCustomerVoucherClaims(user.uid)
    ])
      .then(([profile, claims]) => {
        if (!active) return;
        setCustomerProfile(profile);
        setClaimedVoucherIds(new Set(claims.map((claim) => claim.voucherId || claim.id)));
      })
      .catch((claimsError) => {
        console.error('Không thể tải voucher đã lấy:', claimsError);
        if (active) setClaimError('Không thể tải Kho voucher. Vui lòng kiểm tra Firebase Database Rules.');
      })
      .finally(() => {
        if (active) setClaimLoading(false);
      });

    return () => { active = false; };
  }, [user?.uid]);

  const claimVoucher = async (voucher) => {
    if (!user?.uid) return;
    setClaimError('');
    setClaimNotice('');
    setClaimingVoucherId(voucher.id);
    try {
      await claimCustomerVoucher(user.uid, voucher.id);
      setClaimedVoucherIds((current) => new Set(current).add(voucher.id));
      setClaimNotice(`Đã lưu mã ${voucher.code} vào Kho voucher của bạn.`);
    } catch (claimFailure) {
      console.error('Không thể lấy voucher:', claimFailure);
      setClaimError(claimFailure.message || 'Không thể lưu voucher. Vui lòng thử lại.');
    } finally {
      setClaimingVoucherId('');
    }
  };

  const eligibleVouchers = vouchers.filter((voucher) => (
    voucher.audienceType !== 'tier' ||
    (user && customerProfile?.tier && voucher.targetTier === customerProfile.tier)
  ));
  const voucherPageCount = Math.ceil(eligibleVouchers.length / VOUCHERS_PER_PAGE);
  const currentVoucherPage = Math.min(voucherPage, Math.max(0, voucherPageCount - 1));
  const visibleVouchers = eligibleVouchers.slice(
    currentVoucherPage * VOUCHERS_PER_PAGE,
    currentVoucherPage * VOUCHERS_PER_PAGE + VOUCHERS_PER_PAGE
  );

  const changeVoucherPage = (direction) => {
    setVoucherPage((current) => (
      (current + direction + voucherPageCount) % voucherPageCount
    ));
  };

  return (
    <div className="store-vouchers-page">
      <div className="store-vouchers-container">
        <header className="store-vouchers-heading">
          <div>
            <span className="store-vouchers-eyebrow">ƯU ĐÃI TỪ NP FOOD</span>
            <h1>Voucher dành cho bạn</h1>
            <p>Lưu mã ưu đãi đang áp dụng và xem điều kiện sử dụng trước khi đặt hàng.</p>
          </div>
          <div className="store-vouchers-heading-side">
            {user && <span>{claimedVoucherIds.size} voucher đã lấy</span>}
            <span className="store-vouchers-heading-icon" aria-hidden="true">🎟</span>
          </div>
        </header>

        {claimError && <p className="store-vouchers-copy-error" role="alert">{claimError}</p>}
        {claimNotice && <p className="store-vouchers-claim-notice" role="status">{claimNotice}</p>}

        {loading ? (
          <div className="store-vouchers-state">Đang tải voucher...</div>
        ) : error ? (
          <div className="store-vouchers-state store-vouchers-error" role="alert">
            <strong>{error}</strong>
            <button type="button" onClick={fetchVouchers}>Thử tải lại</button>
          </div>
        ) : eligibleVouchers.length === 0 ? (
          <div className="store-vouchers-state">
            <span aria-hidden="true">🎟</span>
            <strong>{vouchers.length ? 'Chưa có voucher phù hợp với hạng thành viên' : 'Hiện chưa có voucher khả dụng'}</strong>
            <p>Các ưu đãi mới sẽ được cập nhật tại đây.</p>
            <Link to="/products" className="store-vouchers-shop-link">Khám phá sản phẩm</Link>
          </div>
        ) : (
          <>
            {voucherPageCount > 1 && (
              <div className="store-vouchers-pagination" aria-label="Điều hướng voucher">
                <button type="button" onClick={() => changeVoucherPage(-1)} aria-label="Nhóm voucher trước">‹</button>
                <span>{currentVoucherPage + 1} / {voucherPageCount}</span>
                <button type="button" onClick={() => changeVoucherPage(1)} aria-label="Nhóm voucher tiếp theo">›</button>
              </div>
            )}
            <div className="store-vouchers-grid">
              {visibleVouchers.map((voucher) => {
                const isClaimed = claimedVoucherIds.has(voucher.id);
                return (
                  <article className="store-voucher-card" key={voucher.id}>
                    <div className="store-voucher-card-top">
                      <span className="store-voucher-tag">
                        {voucher.audienceType === 'tier' ? `HẠNG ${voucher.targetTier || 'THÀNH VIÊN'}` : 'ƯU ĐÃI CHUNG'}
                      </span>
                      <span className="store-voucher-ticket" aria-hidden="true">✦</span>
                    </div>
                    <h2>{voucher.name || 'Ưu đãi NP Food'}</h2>
                    <strong className="store-voucher-discount">
                      {voucher.discountType === 'percent'
                        ? `Giảm ${Number(voucher.discountValue) || 0}%`
                        : `Giảm ${formatMoney(voucher.discountValue)}`}
                    </strong>
                    <div className="store-voucher-code-row">
                      <code>{voucher.code}</code>
                    </div>
                    {!user ? (
                      <Link to="/login" state={{ from: '/vouchers' }} className="store-voucher-claim-button">
                        Đăng nhập để lấy
                      </Link>
                    ) : isClaimed ? (
                      <Link
                        to="/account"
                        state={{ accountSection: 'vouchers' }}
                        className="store-voucher-claim-button is-claimed"
                      >
                        Đã lấy · Vào Kho voucher
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className="store-voucher-claim-button"
                        onClick={() => claimVoucher(voucher)}
                        disabled={claimLoading || claimingVoucherId === voucher.id}
                      >
                        {claimingVoucherId === voucher.id ? 'Đang lưu...' : 'Lấy voucher'}
                      </button>
                    )}
                    <ul className="store-voucher-conditions">
                      <li>{Number(voucher.minOrder) > 0 ? `Đơn tối thiểu ${formatMoney(voucher.minOrder)}` : 'Không yêu cầu giá trị đơn tối thiểu'}</li>
                      <li>{formatExpiry(voucher.expiresAt)}</li>
                      {voucher.audienceType === 'tier' && <li>Chỉ dành cho thành viên hạng {voucher.targetTier}</li>}
                    </ul>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Vouchers;
