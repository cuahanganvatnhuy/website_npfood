import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  getActiveBanners,
  getActiveProducts,
  getAllCategories,
  getAvailableVouchers,
  claimCustomerVoucher,
  getCustomerVoucherClaims,
  getPublishedNews
} from '../services/dataService';
import { getCustomerProfile } from '../services/customerAuthService';
import ProductCard from '../components/ProductCard';
import '../css/Home.css';

const Home = ({ addToCart, user }) => {
  const navigate = useNavigate();
  const [banners, setBanners] = useState([]);
  const [products, setProducts] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [currentBanner, setCurrentBanner] = useState(0);
  const [customerProfile, setCustomerProfile] = useState(null);
  const [claimedVoucherIds, setClaimedVoucherIds] = useState(new Set());
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimingVoucherId, setClaimingVoucherId] = useState('');
  const [voucherClaimError, setVoucherClaimError] = useState('');
  const [voucherClaimNotice, setVoucherClaimNotice] = useState('');
  const [homeVoucherPage, setHomeVoucherPage] = useState(0);
  const [isMobileLayout, setIsMobileLayout] = useState(false);
  const categoryGridRef = useRef(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 480px)');
    const updateMobileLayout = () => {
      setIsMobileLayout(mediaQuery.matches);
      setHomeVoucherPage(0);
    };

    updateMobileLayout();
    mediaQuery.addEventListener('change', updateMobileLayout);
    return () => mediaQuery.removeEventListener('change', updateMobileLayout);
  }, []);

  useEffect(() => {
    if (banners.length < 2) return undefined;
    const intervalId = window.setInterval(() => {
      setCurrentBanner((current) => (current + 1) % banners.length);
    }, 5500);
    return () => window.clearInterval(intervalId);
  }, [banners.length]);

  useEffect(() => {
    if (!user?.uid) {
      setCustomerProfile(null);
      setClaimedVoucherIds(new Set());
      setClaimLoading(false);
      setVoucherClaimError('');
      return undefined;
    }

    let active = true;
    setClaimLoading(true);
    setVoucherClaimError('');
    Promise.all([
      getCustomerProfile(user.uid),
      getCustomerVoucherClaims(user.uid)
    ])
      .then(([profile, claims]) => {
        if (!active) return;
        setCustomerProfile(profile);
        setClaimedVoucherIds(new Set(claims.map((claim) => claim.voucherId || claim.id)));
      })
      .catch((error) => {
        console.error('Không thể tải voucher đã lấy:', error);
        if (active) setVoucherClaimError('Không thể tải Kho voucher. Vui lòng kiểm tra Firebase Database Rules.');
      })
      .finally(() => {
        if (active) setClaimLoading(false);
      });

    return () => { active = false; };
  }, [user?.uid]);

  const fetchData = async () => {
    setLoadError('');
    const loadSection = async (label, request, apply, onError) => {
      try {
        apply(await request());
      } catch (error) {
        console.error(`Lỗi khi tải ${label}:`, error);
        onError?.(error);
      }
    };

    const productsRequest = loadSection(
      'sản phẩm',
      getActiveProducts,
      setProducts,
      (error) => setLoadError(error.message || 'Không thể tải sản phẩm.')
    );
    const secondaryRequests = [
      loadSection('danh mục', getAllCategories, setCategories),
      loadSection('banner', getActiveBanners, setBanners),
      loadSection('tin tức', getPublishedNews, (items) => setNews(items.slice(0, 3))),
      loadSection('voucher', getAvailableVouchers, setVouchers)
    ];

    await productsRequest;
    setLoading(false);
    await Promise.all(secondaryRequests);
  };

  const usedCategories = useMemo(() => {
    const productCategoryIds = new Set(products.map((product) => product.categoryId).filter(Boolean));
    return categories.filter((category) => category.isActive !== false && productCategoryIds.has(category.id));
  }, [products, categories]);

  const currentBannerData = banners[currentBanner];
  const featuredProducts = products.slice(0, 8);
  const categoryProductGroups = useMemo(() => usedCategories
    .map((category) => ({
      category,
      products: products
        .filter((product) => product.categoryId === category.id)
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
        .slice(0, 10)
    }))
    .filter((group) => group.products.length > 0), [products, usedCategories]);
  const flashSaleProducts = products.filter((product) => product.flashSale).slice(0, 5);
  const homeVouchers = vouchers.filter((voucher) => (
    voucher.code &&
    (voucher.audienceType !== 'tier' ||
      (user && customerProfile?.tier && voucher.targetTier === customerProfile.tier))
  ));
  const homeVouchersPerPage = isMobileLayout ? 4 : 5;
  const homeVoucherPageCount = Math.ceil(homeVouchers.length / homeVouchersPerPage);
  const currentHomeVoucherPage = Math.min(
    homeVoucherPage,
    Math.max(0, homeVoucherPageCount - 1)
  );
  const visibleHomeVouchers = homeVouchers.slice(
    currentHomeVoucherPage * homeVouchersPerPage,
    currentHomeVoucherPage * homeVouchersPerPage + homeVouchersPerPage
  );

  const claimVoucher = async (voucher) => {
    if (!user?.uid) {
      navigate('/login', { state: { from: '/' } });
      return;
    }
    setVoucherClaimError('');
    setVoucherClaimNotice('');
    setClaimingVoucherId(voucher.id);
    try {
      await claimCustomerVoucher(user.uid, voucher.id);
      setClaimedVoucherIds((current) => new Set(current).add(voucher.id));
      setVoucherClaimNotice(`Đã lưu mã ${voucher.code} vào Kho voucher của bạn.`);
    } catch (error) {
      console.error('Không thể lấy voucher:', error);
      setVoucherClaimError(error.message || 'Không thể lưu voucher. Vui lòng thử lại.');
    } finally {
      setClaimingVoucherId('');
    }
  };

  const changeHomeVoucherPage = (direction) => {
    setHomeVoucherPage((current) => (
      (current + direction + homeVoucherPageCount) % homeVoucherPageCount
    ));
  };

  const scrollCategories = (direction) => {
    const categoryGrid = categoryGridRef.current;
    const firstCategory = categoryGrid?.querySelector('.store-category-tile');
    if (!categoryGrid || !firstCategory) return;

    const gap = Number.parseFloat(window.getComputedStyle(categoryGrid).columnGap) || 0;
    categoryGrid.scrollBy({
      left: direction * (firstCategory.getBoundingClientRect().width + gap),
      behavior: 'smooth'
    });
  };

  const openProduct = (product) => {
    navigate(`/products?product=${encodeURIComponent(product.id)}`);
  };

  const openCategory = (categoryId) => {
    navigate(`/products?category=${encodeURIComponent(categoryId)}`);
  };

  const nextBanner = () => setCurrentBanner((current) => (current + 1) % banners.length);
  const previousBanner = () => setCurrentBanner((current) => (current - 1 + banners.length) % banners.length);

  return (
    <div className="store-home-page">
      <section className={`store-hero ${currentBannerData?.imageUrl ? 'has-banner-image' : ''}`}>
        {currentBannerData?.imageUrl && <img className="store-hero-image" src={currentBannerData.imageUrl} alt="" />}
        <div className="store-hero-shade" />
        <div className="store-home-container store-hero-content">
          <div className="store-hero-brand">
            <img src="/logo.png" alt="NP Food" />
            <span className="store-hero-kicker">DINH DƯỠNG TRỌN VẸN · NP FOOD</span>
          </div>
          <h1>{currentBannerData?.title || 'Chọn điều ngon, gửi trọn yêu thương'}</h1>
          <p>{currentBannerData?.description || 'Khám phá những sản phẩm được cửa hàng tuyển chọn cho bữa ăn thêm trọn vị.'}</p>
          <div className="store-hero-actions">
            <button type="button" className="store-primary-button" onClick={() => navigate('/products')}>Khám phá sản phẩm</button>
            <Link to="/about" className="store-hero-secondary">Câu chuyện cửa hàng <span>→</span></Link>
          </div>
          {banners.length > 1 && (
            <div className="store-hero-pagination" aria-label="Chọn banner">
              <button type="button" onClick={previousBanner} aria-label="Banner trước">‹</button>
              <span>{currentBanner + 1} / {banners.length}</span>
              <button type="button" onClick={nextBanner} aria-label="Banner tiếp theo">›</button>
            </div>
          )}
          {currentBannerData?.link && (
            currentBannerData.link.startsWith('/') ? (
              <Link className="store-banner-link" to={currentBannerData.link}>Xem chương trình <span>↗</span></Link>
            ) : (
              <a className="store-banner-link" href={currentBannerData.link} target="_blank" rel="noopener noreferrer">Xem chương trình <span>↗</span></a>
            )
          )}
        </div>
        <span className="store-hero-decoration one" />
        <span className="store-hero-decoration two" />
      </section>

      <section className="store-benefits">
        <div className="store-home-container store-benefits-grid">
          <div><span>✦</span><strong>Sản phẩm chọn lọc</strong><small>Thông tin rõ ràng, dễ lựa chọn</small></div>
          <div><span>⌕</span><strong>Mua sắm tiện lợi</strong><small>Đặt hàng nhanh ngay trên website</small></div>
          <div><span>♡</span><strong>Hỗ trợ tận tình</strong><small>Cửa hàng luôn sẵn sàng giải đáp</small></div>
        </div>
      </section>

      {homeVouchers.length > 0 && (
        <section className="store-home-section store-home-vouchers-section">
          <div className="store-home-container">
            <div className="store-section-heading">
              <div><span className="store-section-kicker">🎟 ƯU ĐÃI DÀNH CHO BẠN</span><h2>Voucher nổi bật</h2></div>
              <Link to="/vouchers" className="store-text-link">Xem tất cả <span>→</span></Link>
            </div>
            {voucherClaimError && <p className="store-home-voucher-copy-error" role="alert">{voucherClaimError}</p>}
            {voucherClaimNotice && <p className="store-home-voucher-claim-notice" role="status">{voucherClaimNotice}</p>}
            {homeVoucherPageCount > 1 && (
              <div className="store-home-voucher-pagination" aria-label="Điều hướng voucher">
                <button type="button" onClick={() => changeHomeVoucherPage(-1)} aria-label="Nhóm voucher trước">‹</button>
                <span>{currentHomeVoucherPage + 1} / {homeVoucherPageCount}</span>
                <button type="button" onClick={() => changeHomeVoucherPage(1)} aria-label="Nhóm voucher tiếp theo">›</button>
              </div>
            )}
            <div className="store-home-voucher-grid">
              {visibleHomeVouchers.map((voucher) => (
                <article className="store-home-voucher-card" key={voucher.id}>
                  <div className="store-home-voucher-info">
                    <span className="store-home-voucher-tag">
                      {voucher.audienceType === 'tier' ? `HẠNG ${voucher.targetTier || 'THÀNH VIÊN'}` : 'MÃ ƯU ĐÃI'}
                    </span>
                    <strong className="store-home-voucher-discount">
                      {voucher.discountType === 'percent'
                        ? `Giảm ${Number(voucher.discountValue) || 0}%`
                        : `Giảm ${Number(voucher.discountValue || 0).toLocaleString('vi-VN')}₫`}
                    </strong>
                    <span className="store-home-voucher-name">{voucher.name || 'Ưu đãi NP Food'}</span>
                    <code>{voucher.code}</code>
                  </div>
                  {claimedVoucherIds.has(voucher.id) ? (
                    <Link
                      to="/account"
                      state={{ accountSection: 'vouchers' }}
                      className="store-home-voucher-claim is-claimed"
                    >
                      Đã lấy
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="store-home-voucher-claim"
                      onClick={() => claimVoucher(voucher)}
                      disabled={claimLoading || claimingVoucherId === voucher.id}
                    >
                      {!user ? 'Đăng nhập để lấy' : claimingVoucherId === voucher.id ? 'Đang lưu...' : 'Lấy voucher'}
                    </button>
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {flashSaleProducts.length > 0 && (
        <section className="store-home-section store-flash-sale-section">
          <div className="store-home-container">
            <div className="store-section-heading">
              <div><span className="store-section-kicker">⚡ ƯU ĐÃI CÓ THỜI HẠN</span><h2>Flash Sale đang diễn ra</h2></div>
              <Link to="/flash-sale" className="store-text-link">Xem tất cả <span>→</span></Link>
            </div>
            <div className="store-flash-sale-products-panel">
              <div className="store-home-product-grid store-flash-sale-products">
                {flashSaleProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    category={categories.find((category) => category.id === product.categoryId && category.isActive !== false)}
                    onOpen={openProduct}
                    onAdd={addToCart}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {usedCategories.length > 0 && (
        <section className="store-home-section store-category-section">
          <div className="store-home-container">
            <div className="store-section-heading">
              <div><span className="store-section-kicker">DỄ DÀNG LỰA CHỌN</span><h2>Mua sắm theo danh mục</h2></div>
              <Link to="/products" className="store-text-link">Tất cả sản phẩm <span>→</span></Link>
            </div>
            {usedCategories.length > 3 && (
              <div className="store-category-controls" aria-label="Điều hướng danh mục">
                <span>Vuốt hoặc bấm để xem thêm</span>
                <button type="button" onClick={() => scrollCategories(-1)} aria-label="Danh mục trước">
                  ‹
                </button>
                <button type="button" onClick={() => scrollCategories(1)} aria-label="Danh mục tiếp theo">
                  ›
                </button>
              </div>
            )}
            <div className="store-category-grid" ref={categoryGridRef} aria-label="Danh mục sản phẩm">
              {usedCategories.map((category) => {
                const categoryProduct = products.find((product) => (
                  product.categoryId === category.id &&
                  (product.imageUrl || (Array.isArray(product.imageUrls) && product.imageUrls.length > 0))
                ));
                const categoryImage = category.imageUrl ||
                  categoryProduct?.imageUrls?.[0] ||
                  categoryProduct?.imageUrl;

                return (
                  <button
                    type="button"
                    className={`store-category-tile ${categoryImage ? 'has-image' : ''}`}
                    key={category.id}
                    onClick={() => openCategory(category.id)}
                  >
                    {categoryImage ? (
                      <img src={categoryImage} alt="" className="store-category-image" loading="lazy" />
                    ) : (
                      <span className="store-category-icon">{category.icon || '✿'}</span>
                    )}
                    <span className="store-category-shade" />
                    <span className="store-category-info">
                      <strong>{category.name}</strong>
                      <small>Khám phá danh mục <b>→</b></small>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <section className="store-home-section store-featured-section">
        <div className="store-home-container">
          <div className="store-section-heading">
            <div><span className="store-section-kicker">GỢI Ý DÀNH CHO BẠN</span><h2>Sản phẩm nổi bật</h2></div>
            <Link to="/products" className="store-text-link">Xem tất cả <span>→</span></Link>
          </div>
          {loading ? (
            <div className="store-home-product-grid store-home-skeleton-grid" role="status" aria-label="Đang tải sản phẩm">
              {Array.from({ length: 5 }, (_, index) => (
                <article className="store-home-skeleton-card" key={index} aria-hidden="true">
                  <span className="store-home-skeleton-image" />
                  <span className="store-home-skeleton-line" />
                  <span className="store-home-skeleton-line short" />
                </article>
              ))}
            </div>
          ) : loadError ? (
            <div className="store-home-error" role="alert">
              <p>{loadError}</p>
              <button type="button" onClick={() => { setLoading(true); fetchData(); }}>Thử tải lại</button>
            </div>
          ) : featuredProducts.length === 0 ? (
            <div className="store-home-empty">
              <span>📦</span><strong>Sản phẩm sẽ sớm có mặt</strong>
              <p>Cửa hàng đang cập nhật gian hàng. Hãy quay lại sau nhé.</p>
            </div>
          ) : (
            <div className="store-home-product-grid">
              {featuredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  category={categories.find((category) => category.id === product.categoryId && category.isActive !== false)}
                  onOpen={openProduct}
                  onAdd={addToCart}
                />
              ))}
            </div>
          )}
          <div className="store-section-action">
            <Link to="/products" className="store-outline-button">Xem toàn bộ sản phẩm</Link>
          </div>
        </div>
      </section>

      {categoryProductGroups.map(({ category, products: categoryProducts }, index) => (
        <section
          className={`store-home-section store-category-products-section ${index % 2 ? 'is-alt' : ''}`}
          key={category.id}
        >
          <div className="store-home-container">
            <div className="store-section-heading">
              <div>
                <span className="store-section-kicker">SẢN PHẨM MỚI NHẤT THEO DANH MỤC</span>
                <h2>{category.name}</h2>
              </div>
              <Link
                to={`/products?category=${encodeURIComponent(category.id)}`}
                className="store-text-link"
              >
                Xem tất cả <span>→</span>
              </Link>
            </div>
            <div className="store-home-product-grid">
              {categoryProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  category={category}
                  onOpen={openProduct}
                  onAdd={addToCart}
                />
              ))}
            </div>
          </div>
        </section>
      ))}

      {news.length > 0 && (
        <section className="store-home-section store-news-section">
          <div className="store-home-container">
            <div className="store-section-heading">
              <div><span className="store-section-kicker">TỪ NP FOOD</span><h2>Tin mới từ cửa hàng</h2></div>
              <Link to="/news" className="store-text-link">Xem tất cả tin <span>→</span></Link>
            </div>
            <div className="store-home-news-grid">
              {news.map((item) => (
                <Link to={`/news/${item.id}`} key={item.id} className="store-home-news-card">
                  {item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" /> : <span className="store-home-news-placeholder">✦</span>}
                  <div><small>{item.createdAt ? new Date(item.createdAt).toLocaleDateString('vi-VN') : 'Tin từ cửa hàng'}</small><h3>{item.title}</h3><p>{item.summary || item.content}</p></div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="store-home-cta">
        <div className="store-home-container">
          <div><span className="store-section-kicker">CẦN CHÚNG TÔI HỖ TRỢ?</span><h2>NP Food luôn sẵn lòng lắng nghe</h2><p>Liên hệ để được tư vấn thêm về sản phẩm và đơn hàng của bạn.</p></div>
          <Link to="/contact" className="store-primary-button">Liên hệ cửa hàng <span>→</span></Link>
        </div>
      </section>
    </div>
  );
};

export default Home;
