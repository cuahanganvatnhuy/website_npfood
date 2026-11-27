import { useEffect, useMemo, useState } from 'react';
import {
  deleteFlashSale,
  getAllFlashSales,
  publishFlashSale,
  saveFlashSaleDraft,
  setFlashSaleActive
} from '../services/flashSaleService.js';
import { getAllProducts } from '../services/productService.js';
import CurrencyInput from '../components/CurrencyInput.js';
import LoadingSpinner from '../components/LoadingSpinner.js';
import '../css/FlashSales.css';

const toDateTimeInput = (date) => {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
};

const fromDateTimeInput = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : toDateTimeInput(date);
};

const createEmptyCampaign = () => {
  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);
  return {
    name: '',
    startsAt: toDateTimeInput(startsAt),
    endsAt: toDateTimeInput(endsAt),
    productIds: []
  };
};

const formatPrice = (value) => `${Number(value || 0).toLocaleString('vi-VN')} ₫`;

const getProductImage = (product) => (
  product.imageUrls?.[0] || product.imageUrl || ''
);

const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(date);
};

const getCampaignStatus = (campaign) => {
  if (campaign.status === 'draft') return { label: 'Bản nháp', className: 'is-draft' };
  if (!campaign.isActive) return { label: 'Đang tắt', className: 'is-disabled' };

  const startsAt = new Date(campaign.startsAt).getTime();
  const endsAt = new Date(campaign.endsAt).getTime();
  const now = Date.now();
  if (now < startsAt) return { label: 'Sắp diễn ra', className: 'is-upcoming' };
  if (now >= endsAt) return { label: 'Đã kết thúc', className: 'is-ended' };
  return { label: 'Đang diễn ra', className: 'is-running' };
};

const getCampaignProductIds = (campaign) => (
  Object.keys(campaign.status === 'draft'
    ? campaign.selectedProductIds || {}
    : campaign.products || {})
);

const FlashSales = () => {
  const [products, setProducts] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editorStep, setEditorStep] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [editingPublishedCampaign, setEditingPublishedCampaign] = useState(false);
  const [campaignForm, setCampaignForm] = useState(createEmptyCampaign);
  const [salePrices, setSalePrices] = useState({});
  const [productSearch, setProductSearch] = useState('');
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [productData, campaignData] = await Promise.all([
        getAllProducts(),
        getAllFlashSales()
      ]);
      setProducts(productData);
      setCampaigns(campaignData);
    } catch (loadFailure) {
      console.error('Không thể tải dữ liệu Flash Sale:', loadFailure);
      setLoadError(loadFailure.message || 'Không thể tải dữ liệu Flash Sale.');
    } finally {
      setLoading(false);
    }
  };

  const productsById = useMemo(
    () => Object.fromEntries(products.map((product) => [product.id, product])),
    [products]
  );
  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLocaleLowerCase();
    return products.filter((product) => (
      product.isActive !== false &&
      String(product.name || '').toLocaleLowerCase().includes(query)
    ));
  }, [products, productSearch]);
  const runningCount = campaigns.filter(
    (campaign) => getCampaignStatus(campaign).className === 'is-running'
  ).length;

  const resetEditor = () => {
    setEditorStep('');
    setCampaignId('');
    setEditingPublishedCampaign(false);
    setCampaignForm(createEmptyCampaign());
    setSalePrices({});
    setProductSearch('');
    setError('');
  };

  const openNewCampaign = () => {
    setCampaignId('');
    setEditingPublishedCampaign(false);
    setCampaignForm(createEmptyCampaign());
    setSalePrices({});
    setProductSearch('');
    setError('');
    setEditorStep('details');
  };

  const copyCampaign = (campaign) => {
    const productIds = getCampaignProductIds(campaign);
    const copySuffix = ' (Sao chép)';
    const sourceName = campaign.name || 'Flash Sale';
    const name = `${sourceName.slice(0, 80 - copySuffix.length)}${copySuffix}`;

    setCampaignId('');
    setEditingPublishedCampaign(false);
    setCampaignForm({
      name,
      startsAt: fromDateTimeInput(campaign.startsAt),
      endsAt: fromDateTimeInput(campaign.endsAt),
      productIds
    });
    setSalePrices(Object.fromEntries(productIds.map((productId) => [
      productId,
      campaign.products?.[productId]?.salePrice ?? ''
    ])));
    setProductSearch('');
    setError('');
    setEditorStep('details');
  };

  const openCampaignPrices = (campaign) => {
    const productIds = getCampaignProductIds(campaign);
    setCampaignId(campaign.id);
    setEditingPublishedCampaign(campaign.status === 'published');
    setCampaignForm({
      name: campaign.name || '',
      startsAt: fromDateTimeInput(campaign.startsAt),
      endsAt: fromDateTimeInput(campaign.endsAt),
      productIds
    });
    setSalePrices(Object.fromEntries(productIds.map((productId) => [
      productId,
      campaign.products?.[productId]?.salePrice ?? ''
    ])));
    setError('');
    setEditorStep('prices');
  };

  const handleProductSelection = (productId, checked) => {
    setCampaignForm((current) => ({
      ...current,
      productIds: checked
        ? [...new Set([...current.productIds, productId])]
        : current.productIds.filter((id) => id !== productId)
    }));
  };

  const handleSaveSelection = async (event) => {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      const savedId = await saveFlashSaleDraft(campaignId, campaignForm);
      setCampaignId(savedId);
      setSalePrices((current) => Object.fromEntries(
        campaignForm.productIds.map((productId) => [productId, current[productId] ?? ''])
      ));
      await loadData();
      setEditorStep('prices');
    } catch (saveError) {
      console.error('Không thể lưu danh sách sản phẩm Flash Sale:', saveError);
      setError(saveError.message || 'Không thể lưu danh sách sản phẩm.');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (event) => {
    event.preventDefault();
    setError('');
    const campaignProducts = {};

    for (const productId of campaignForm.productIds) {
      const product = productsById[productId];
      const salePrice = Number(salePrices[productId]);
      if (!product) {
        setError('Một sản phẩm trong danh sách không còn tồn tại.');
        return;
      }
      if (!Number.isFinite(salePrice) || salePrice <= 0 || salePrice >= Number(product.price)) {
        setError(`Giá Flash Sale của "${product.name}" phải lớn hơn 0 và thấp hơn giá bán hiện tại.`);
        return;
      }
      campaignProducts[productId] = { salePrice };
    }

    setSaving(true);
    try {
      await publishFlashSale(campaignId, campaignProducts);
      await loadData();
      resetEditor();
    } catch (publishError) {
      console.error('Không thể đăng chương trình Flash Sale:', publishError);
      setError(publishError.message || 'Đăng chương trình thất bại.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleCampaign = async (campaign) => {
    try {
      await setFlashSaleActive(campaign.id, !campaign.isActive);
      await loadData();
    } catch (toggleError) {
      console.error('Không thể cập nhật chương trình Flash Sale:', toggleError);
      setLoadError(toggleError.message || 'Không thể cập nhật chương trình.');
    }
  };

  const handleDeleteCampaign = async (campaign) => {
    if (!window.confirm(`Xóa chương trình "${campaign.name}"?`)) return;
    try {
      await deleteFlashSale(campaign.id);
      await loadData();
    } catch (deleteError) {
      console.error('Không thể xóa chương trình Flash Sale:', deleteError);
      setLoadError(deleteError.message || 'Không thể xóa chương trình.');
    }
  };

  const renderCampaignDetailsStep = () => (
    <form className="flash-sales-form" onSubmit={handleSaveSelection}>
      <div className="flash-sales-form-heading">
        <div>
          <span className="flash-sales-step">BƯỚC 1 / 2</span>
          <h3>Tạo chương trình và chọn sản phẩm</h3>
          <p>Chọn các sản phẩm sẽ tham gia chương trình Flash Sale.</p>
        </div>
        <button type="button" className="flash-sales-close" onClick={resetEditor} aria-label="Đóng form">×</button>
      </div>

      {error && <div className="flash-sales-error" role="alert">{error}</div>}

      <div className="flash-sales-form-grid">
        <label className="flash-sales-field flash-sales-product-field">
          <span>Tên chương trình</span>
          <input
            type="text"
            required
            maxLength="80"
            value={campaignForm.name}
            onChange={(event) => setCampaignForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="Ví dụ: Flash Sale cuối tuần"
          />
        </label>
        <label className="flash-sales-field">
          <span>Bắt đầu</span>
          <input
            type="datetime-local"
            required
            value={campaignForm.startsAt}
            onChange={(event) => setCampaignForm((current) => ({ ...current, startsAt: event.target.value }))}
          />
        </label>
        <label className="flash-sales-field">
          <span>Kết thúc</span>
          <input
            type="datetime-local"
            required
            value={campaignForm.endsAt}
            onChange={(event) => setCampaignForm((current) => ({ ...current, endsAt: event.target.value }))}
          />
        </label>
      </div>

      <div className="flash-sales-product-picker">
        <div className="flash-sales-picker-heading">
          <div>
            <strong>Danh sách sản phẩm</strong>
            <span>Đã chọn {campaignForm.productIds.length} sản phẩm</span>
          </div>
          <input
            type="search"
            value={productSearch}
            onChange={(event) => setProductSearch(event.target.value)}
            placeholder="Tìm sản phẩm..."
            aria-label="Tìm sản phẩm"
          />
        </div>
        {filteredProducts.length === 0 ? (
          <p className="flash-sales-no-products">Không có sản phẩm phù hợp.</p>
        ) : (
          <div className="flash-sales-product-list">
            {filteredProducts.map((product) => (
              <label key={product.id} className="flash-sales-product-option">
                <input
                  type="checkbox"
                  checked={campaignForm.productIds.includes(product.id)}
                  onChange={(event) => handleProductSelection(product.id, event.target.checked)}
                />
                {getProductImage(product) ? (
                  <img className="flash-sales-product-image" src={getProductImage(product)} alt="" />
                ) : (
                  <span className="flash-sales-product-icon" aria-hidden="true">📦</span>
                )}
                <span className="flash-sales-option-details">
                  <strong>{product.name}</strong>
                  <small>{product.sku || 'Không có mã sản phẩm'}</small>
                </span>
                <span className="flash-sales-option-price">{formatPrice(product.price)}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="flash-sales-form-actions">
        <button type="button" className="flash-sales-cancel" onClick={resetEditor}>Hủy</button>
        <button type="submit" className="flash-sales-save" disabled={saving}>
          {saving ? 'Đang lưu...' : 'Lưu danh sách'}
        </button>
      </div>
    </form>
  );

  const renderCampaignPricesStep = () => (
    <form className="flash-sales-form" onSubmit={handlePublish}>
      <div className="flash-sales-form-heading">
        <div>
          <span className="flash-sales-step">BƯỚC 2 / 2</span>
          <h3>{editingPublishedCampaign ? 'Cập nhật giá Flash Sale' : 'Nhập giá giảm cho từng sản phẩm'}</h3>
          <p>{campaignForm.name} · Giá giảm phải thấp hơn giá bán hiện tại.</p>
        </div>
        <button type="button" className="flash-sales-close" onClick={resetEditor} aria-label="Đóng form">×</button>
      </div>

      {error && <div className="flash-sales-error" role="alert">{error}</div>}

      <div className="flash-sales-price-list">
        {campaignForm.productIds.map((productId) => {
          const product = productsById[productId];
          if (!product) {
            return (
              <div key={productId} className="flash-sales-price-row missing">
                <strong>Sản phẩm không còn tồn tại</strong>
                <span>Hãy quay lại và bỏ sản phẩm này khỏi chương trình.</span>
              </div>
            );
          }
          const salePrice = Number(salePrices[productId]);
          const discount = salePrice > 0 && Number(product.price) > 0
            ? Math.round((1 - salePrice / Number(product.price)) * 100)
            : 0;

          return (
            <div key={productId} className="flash-sales-price-row">
              {getProductImage(product) ? (
                <img className="flash-sales-product-image" src={getProductImage(product)} alt="" />
              ) : (
                <span className="flash-sales-product-icon" aria-hidden="true">📦</span>
              )}
              <span className="flash-sales-price-product">
                <strong>{product.name}</strong>
                <small>Giá thường: {formatPrice(product.price)}</small>
              </span>
              <label className="flash-sales-price-input">
                <span>Giá giảm (₫)</span>
                <CurrencyInput
                  required
                  value={salePrices[productId] ?? ''}
                  onValueChange={(value) => setSalePrices((current) => ({
                    ...current,
                    [productId]: value
                  }))}
                  placeholder="Nhập giá sale"
                />
              </label>
              <span className="flash-sales-price-discount">
                {discount > 0 ? `Giảm ${discount}%` : '—'}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flash-sales-form-actions">
        {!editingPublishedCampaign && (
          <button type="button" className="flash-sales-cancel" onClick={() => setEditorStep('details')}>
            Sửa danh sách
          </button>
        )}
        {editingPublishedCampaign && (
          <button type="button" className="flash-sales-cancel" onClick={resetEditor}>Hủy</button>
        )}
        <button type="submit" className="flash-sales-save" disabled={saving}>
          {saving ? 'Đang đăng...' : editingPublishedCampaign ? 'Cập nhật chương trình' : 'Đăng chương trình'}
        </button>
      </div>
    </form>
  );

  return (
    <div className="flash-sales-page">
      <header className="flash-sales-heading">
        <div>
          <span className="flash-sales-eyebrow">MARKETING</span>
          <h2>Flash Sale</h2>
          <p>Tạo chương trình, chọn sản phẩm và thiết lập giá giảm cho từng mặt hàng.</p>
        </div>
        {editorStep !== 'details' && (
          <div className="flash-sales-summary">
            <span>Đang diễn ra</span>
            <strong>{runningCount}</strong>
          </div>
        )}
      </header>

      {loadError && <div className="flash-sales-error" role="alert">{loadError}</div>}

      {editorStep === 'details' && renderCampaignDetailsStep()}
      {editorStep === 'prices' && renderCampaignPricesStep()}

      {!editorStep && (
        <section className="flash-sales-card">
          <div className="flash-sales-toolbar">
            <div>
              <h3>Chương trình Flash Sale</h3>
              <p>{campaigns.length} chương trình</p>
            </div>
            <button type="button" className="flash-sales-add-button" onClick={openNewCampaign}>
              <span aria-hidden="true">＋</span>
              Tạo chương trình
            </button>
          </div>

          {loading ? (
            <div className="flash-sales-loading">
              <LoadingSpinner message="Đang tải chương trình..." inline />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="flash-sales-empty">
              <span aria-hidden="true">⚡</span>
              <strong>Chưa có chương trình Flash Sale</strong>
              <p>Tạo chương trình, chọn sản phẩm rồi thiết lập giá giảm để đăng.</p>
            </div>
          ) : (
            <div className="flash-sales-table-scroll">
              <table className="flash-sales-table">
                <thead>
                  <tr>
                    <th>Chương trình</th>
                    <th>Sản phẩm</th>
                    <th>Thời gian</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((campaign) => {
                    const productIds = getCampaignProductIds(campaign);
                    const status = getCampaignStatus(campaign);
                    const campaignProductNames = productIds
                      .map((id) => productsById[id]?.name)
                      .filter(Boolean);

                    return (
                      <tr key={campaign.id}>
                        <td>
                          <div className="flash-sales-campaign-name">
                            <strong>{campaign.name || 'Flash Sale'}</strong>
                            <small>{campaign.status === 'draft' ? 'Chưa đăng' : `${productIds.length} sản phẩm đã chọn`}</small>
                          </div>
                        </td>
                        <td>
                          <div className="flash-sales-campaign-products">
                            {campaignProductNames.length > 0
                              ? campaignProductNames.slice(0, 2).join(', ')
                              : 'Không có sản phẩm'}
                            {campaignProductNames.length > 2 && ` +${campaignProductNames.length - 2}`}
                          </div>
                        </td>
                        <td className="flash-sales-period">
                          <span>{formatDate(campaign.startsAt)}</span>
                          <span>{formatDate(campaign.endsAt)}</span>
                        </td>
                        <td><span className={`flash-sales-status ${status.className}`}>{status.label}</span></td>
                        <td>
                          <div className="flash-sales-actions">
                            <button
                              type="button"
                              className="flash-sales-action copy"
                              onClick={() => copyCampaign(campaign)}
                              aria-label={`Sao chép chương trình ${campaign.name || 'Flash Sale'}`}
                              title="Sao chép chương trình"
                            >
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <rect x="8" y="8" width="12" height="12" rx="2" />
                                <path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3" />
                              </svg>
                              Sao chép
                            </button>
                            {campaign.status === 'draft' ? (
                              <button
                                type="button"
                                className="flash-sales-action edit"
                                onClick={() => openCampaignPrices(campaign)}
                              >
                                Tiếp tục
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="flash-sales-action edit"
                                  onClick={() => openCampaignPrices(campaign)}
                                >
                                  Sửa giá
                                </button>
                                <button
                                  type="button"
                                  className="flash-sales-action toggle"
                                  onClick={() => handleToggleCampaign(campaign)}
                                >
                                  {campaign.isActive ? 'Tắt' : 'Bật'}
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              className="flash-sales-action delete"
                              onClick={() => handleDeleteCampaign(campaign)}
                            >
                              Xóa
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default FlashSales;
