import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getActiveMarketplaceChannels } from '../services/dataService';
import '../css/Navigation.css';

const Navigation = ({ cartCount = 0, user = null, isChatOpen = false, onToggleChat }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [marketplaceChannels, setMarketplaceChannels] = useState([]);
  const [marketplaceLoading, setMarketplaceLoading] = useState(true);
  const [marketplaceError, setMarketplaceError] = useState('');
  const [isDesktopMarketplaceOpen, setIsDesktopMarketplaceOpen] = useState(false);
  const [isMobileMarketplaceOpen, setIsMobileMarketplaceOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const searchFromUrl = new URLSearchParams(location.search).get('search') || '';

  useEffect(() => {
    let isMounted = true;
    getActiveMarketplaceChannels()
      .then((channels) => {
        if (isMounted) setMarketplaceChannels(channels);
      })
      .catch((error) => {
        console.error('Không thể tải các kênh TMĐT:', error);
        if (isMounted) setMarketplaceError('Không thể tải danh sách kênh.');
      })
      .finally(() => {
        if (isMounted) setMarketplaceLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setSearchTerm(searchFromUrl);
  }, [searchFromUrl]);

  useEffect(() => {
    setIsDesktopMarketplaceOpen(false);
    setIsMobileMarketplaceOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isMenuOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMenuOpen]);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    let accumulatedScroll = 0;

    const handleScroll = () => {
      const currentScrollY = Math.max(0, window.scrollY);
      const scrollDelta = currentScrollY - lastScrollY;
      lastScrollY = currentScrollY;

      if (currentScrollY < 48 || isMenuOpen) {
        accumulatedScroll = 0;
        setIsHeaderHidden(false);
        return;
      }

      if (document.activeElement?.closest('.store-navigation')) {
        accumulatedScroll = 0;
        return;
      }

      if (accumulatedScroll !== 0 && Math.sign(scrollDelta) !== Math.sign(accumulatedScroll)) {
        accumulatedScroll = scrollDelta;
      } else {
        accumulatedScroll += scrollDelta;
      }

      if (accumulatedScroll > 14) {
        setIsHeaderHidden(true);
        accumulatedScroll = 0;
      } else if (accumulatedScroll < -10) {
        setIsHeaderHidden(false);
        accumulatedScroll = 0;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isMenuOpen]);

  const handleSearch = (event) => {
    event.preventDefault();
    const query = searchTerm.trim();
    navigate(query ? `/products?search=${encodeURIComponent(query)}` : '/products');
    setIsMenuOpen(false);
  };

  const renderMarketplaceItems = (onSelect) => {
    if (marketplaceLoading) {
      return <li className="store-nav-marketplace-empty">Đang tải kênh...</li>;
    }
    if (marketplaceError) {
      return <li className="store-nav-marketplace-empty" role="status">{marketplaceError}</li>;
    }
    if (marketplaceChannels.length === 0) {
      return <li className="store-nav-marketplace-empty">Chưa có kênh nào</li>;
    }
    return marketplaceChannels.map((channel) => (
      <li key={channel.id}>
        <a
          href={channel.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onSelect}
        >
          <span>{channel.name}</span>
          <span aria-hidden="true">↗</span>
        </a>
      </li>
    ));
  };

  const navItems = [
    { path: '/', label: 'Trang chủ' },
    { path: '/products', label: 'Sản phẩm' },
    { path: '/flash-sale', label: 'Flash Sale' },
    { path: '/about', label: 'Về NP Food' },
    { path: '/news', label: 'Tin tức' },
    { path: '/contact', label: 'Liên hệ' }
  ];

  const isActive = (path) => path === '/'
    ? location.pathname === '/'
    : location.pathname === path || location.pathname.startsWith(`${path}/`);

  return (
    <>
    <nav
      className={`store-navigation ${isHeaderHidden ? 'is-hidden' : ''}`}
      aria-hidden={isHeaderHidden}
      inert={isHeaderHidden}
    >
      <div className="store-nav-container">
        <Link to="/" className="store-nav-brand" onClick={() => setIsMenuOpen(false)}>
          <img src="/logo.png" alt="NP Food" className="store-nav-logo" />
          <span><strong>NP FOOD</strong><small>DINH DƯỠNG TRỌN VẸN</small></span>
        </Link>

        <button
          type="button"
          className="store-nav-toggle"
          onClick={() => {
            setIsMenuOpen((isOpen) => !isOpen);
            setIsMobileMarketplaceOpen(false);
          }}
          aria-label={isMenuOpen ? 'Đóng menu' : 'Mở menu'}
          aria-expanded={isMenuOpen}
        >
          {isMenuOpen ? '×' : '☰'}
        </button>

        <ul className={`store-nav-menu ${isMenuOpen ? 'open' : ''}`}>
          {navItems.map((item) => (
            <li key={item.path}>
              <Link
                to={item.path}
                className={`store-nav-link ${isActive(item.path) ? 'active' : ''}`}
                onClick={() => {
                  setIsMenuOpen(false);
                  setIsMobileMarketplaceOpen(false);
                }}
              >
                {item.label}
              </Link>
            </li>
          ))}
          <li className="store-nav-mobile-marketplace">
            <button
              type="button"
              className="store-nav-mobile-marketplace-trigger"
              aria-expanded={isMobileMarketplaceOpen}
              aria-controls="store-nav-mobile-marketplace-menu"
              onClick={() => setIsMobileMarketplaceOpen((isOpen) => !isOpen)}
            >
              Kênh TMĐT
              <span aria-hidden="true">{isMobileMarketplaceOpen ? '⌃' : '⌄'}</span>
            </button>
            {isMobileMarketplaceOpen && (
              <ul id="store-nav-mobile-marketplace-menu" className="store-nav-mobile-marketplace-menu">
                {renderMarketplaceItems(() => {
                  setIsMobileMarketplaceOpen(false);
                  setIsMenuOpen(false);
                })}
              </ul>
            )}
          </li>
          <li className="store-nav-mobile-account">
            {!user ? (
              <>
                <Link to="/register" className="store-nav-register" onClick={() => setIsMenuOpen(false)}>Đăng ký</Link>
                <Link to="/login" className="store-nav-login" onClick={() => setIsMenuOpen(false)}>Đăng nhập</Link>
              </>
            ) : (
              <Link to="/account" className="store-nav-register" onClick={() => setIsMenuOpen(false)}>Tài khoản</Link>
            )}
          </li>
         
        </ul>

        <div className="store-nav-actions">
          <button
            type="button"
            className="store-nav-chat"
            onClick={() => {
              setIsMenuOpen(false);
              onToggleChat?.();
            }}
            aria-expanded={isChatOpen}
            aria-label="Nhắn tin với shop"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-6a7.5 7.5 0 1 1 17-3.5Z" />
              <path d="M8 11h8M8 14h5" />
            </svg>
            <span>Nhắn shop</span>
          </button>
          <Link
            to="/vouchers"
            className={`store-nav-voucher ${location.pathname === '/vouchers' ? 'active' : ''}`}
            onClick={() => setIsMenuOpen(false)}
          >
            Voucher
          </Link>

          <Link
            to="/cart"
            className={`store-nav-cart ${location.pathname === '/cart' ? 'active' : ''}`}
            aria-label={`Giỏ hàng, ${cartCount} sản phẩm`}
          >
            <span aria-hidden="true">🛒</span>
            {cartCount > 0 && <span className="store-nav-cart-count">{cartCount > 99 ? '99+' : cartCount}</span>}
          </Link>
          <div className="store-nav-marketplace-wrap">
            <button
              type="button"
              className="store-nav-marketplace store-nav-marketplace-desktop"
              aria-expanded={isDesktopMarketplaceOpen}
              aria-controls="store-nav-desktop-marketplace-menu"
              onClick={() => setIsDesktopMarketplaceOpen((isOpen) => !isOpen)}
            >
              Kênh TMĐT
              <span aria-hidden="true">{isDesktopMarketplaceOpen ? '⌃' : '⌄'}</span>
            </button>
            {isDesktopMarketplaceOpen && (
              <ul id="store-nav-desktop-marketplace-menu" className="store-nav-desktop-marketplace-menu">
                {renderMarketplaceItems(() => setIsDesktopMarketplaceOpen(false))}
              </ul>
            )}
          </div>
          <div className="store-nav-auth-links">
            {!user ? (
              <>
                <Link
                  to="/register"
                  className={`store-nav-register ${location.pathname === '/register' ? 'active' : ''}`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  Đăng ký
                </Link>
                <Link
                  to="/login"
                  className={`store-nav-login ${location.pathname === '/login' ? 'active' : ''}`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  Đăng nhập
                </Link>
              </>
            ) : (
              <Link
                to="/account"
                className={`store-nav-register ${location.pathname === '/account' ? 'active' : ''}`}
                onClick={() => setIsMenuOpen(false)}
              >
                Tài khoản
              </Link>
            )}
          </div>
        </div>
      </div>
      <div className="store-nav-search-row">
        <form className="store-nav-search" role="search" onSubmit={handleSearch}>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="10.8" cy="10.8" r="6.8" />
            <path d="m16 16 4.5 4.5" />
          </svg>
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Tìm kiếm sản phẩm..."
            aria-label="Tìm kiếm sản phẩm"
          />
          <button type="submit">Tìm kiếm</button>
        </form>
      </div>
      {isMenuOpen && createPortal(
        <button
          type="button"
          className="store-nav-backdrop"
          aria-label="Đóng menu"
          onClick={() => setIsMenuOpen(false)}
        />,
        document.body
      )}
    </nav>
    </>
  );
};

export default Navigation;
