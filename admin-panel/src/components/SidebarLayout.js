import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import {
  loadAdminNotifications,
  loadAdminNotificationSettings,
  saveAdminNotifications,
  subscribeToAdminNotifications
} from '../services/adminNotificationService.js';
import '../css/SidebarLayout.css';

const formatNotificationTime = (value) => {
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) return 'Vừa xong';
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const SidebarLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(
    () => typeof window === 'undefined' || window.innerWidth > 768
  );
  const location = useLocation();
  const { user, logout } = useAuth();
  const [notifications, setNotifications] = useState(loadAdminNotifications);
  const [notificationSettings, setNotificationSettings] = useState(loadAdminNotificationSettings);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [notificationError, setNotificationError] = useState('');

  const addNotification = useCallback((notification) => {
    setNotifications((current) => {
      if (current.some((item) => item.id === notification.id)) return current;
      return [notification, ...current].slice(0, 100);
    });
  }, []);

  useEffect(() => {
    saveAdminNotifications(notifications);
  }, [notifications]);

  useEffect(() => subscribeToAdminNotifications(
    notificationSettings,
    addNotification,
    () => setNotificationError('Một số thông báo chưa thể đồng bộ.')
  ), [notificationSettings, addNotification]);

  useEffect(() => {
    if (!isNotificationOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsNotificationOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isNotificationOpen]);

  const mainMenuItems = [
    { title: 'Dashboard', path: '/dashboard', icon: '📊' },
    { title: 'Quản lý Sản phẩm', path: '/products', icon: '📦' },
    { title: 'Danh mục sản phẩm', path: '/categories', icon: '📁' },
    { title: 'Quản lý Đơn hàng', path: '/orders', icon: '🧾' },
    { title: 'Cài đặt thanh toán', path: '/payment-settings', icon: '💳' },
    { title: 'Tài khoản khách', path: '/customers', icon: '👥' },
    { title: 'Quản lý Banner', path: '/banner', icon: '🖼️' },
  ];
  const marketingItems = [
    { title: 'Quản lý Voucher', path: '/vouchers', icon: '🎟️' },
    { title: 'Tích điểm & hạng', path: '/loyalty', icon: '⭐' },
    { title: 'Flash Sale', path: '/flash-sales', icon: '⚡' },
    { title: 'Kênh TMĐT', path: '/marketplace-channels', icon: '🛍️' },
  ];
  const informationItems = [
    { title: 'Liên hệ cửa hàng', path: '/contact', icon: '📞' },
    { title: 'Tin nhắn đến', path: '/contact-messages', icon: '✉️' },
    { title: 'Giới thiệu cửa hàng', path: '/introduction', icon: 'ℹ️' },
    { title: 'Tin tức', path: '/news', icon: '📰' },
  ];
  const allMenuItems = [...mainMenuItems, ...marketingItems, ...informationItems];
  const [expandedGroups, setExpandedGroups] = useState(() => ({
    marketing: marketingItems.some((item) => item.path === location.pathname),
    information: informationItems.some((item) => item.path === location.pathname),
  }));

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const toggleGroup = (group) => {
    if (!isSidebarOpen) {
      setIsSidebarOpen(true);
      setExpandedGroups((groups) => ({ ...groups, [group]: true }));
      return;
    }

    setExpandedGroups((groups) => ({ ...groups, [group]: !groups[group] }));
  };

  const renderMenuItems = (items) => items.map((item) => (
    <li key={item.path} className="nav-item">
      <Link
        to={item.path}
        className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
        onClick={() => {
          if (window.innerWidth <= 768) setIsSidebarOpen(false);
        }}
      >
        <span className="nav-icon">{item.icon}</span>
        <span className="nav-text">{item.title}</span>
      </Link>
    </li>
  ));
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  const markAllNotificationsRead = () => {
    setNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
  };

  const clearReadNotifications = () => {
    setNotifications((current) => current.filter((notification) => !notification.read));
  };

  return (
    <div className={`sidebar-layout ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <img src="/npfood-logo.png" alt="NP Food" className="logo-icon" />
            <span className="logo-text">
              <strong>NP FOOD</strong>
              <small>QUẢN TRỊ CỬA HÀNG</small>
            </span>
          </div>
          <button type="button" className="toggle-btn" onClick={toggleSidebar} aria-label="Thu gọn menu">
            {isSidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        <nav className="sidebar-nav">
          <ul className="nav-list">
            {renderMenuItems(mainMenuItems)}
            {[
              { key: 'marketing', title: 'Marketing', icon: '📣', items: marketingItems },
              { key: 'information', title: 'Thông tin', icon: 'ℹ️', items: informationItems },
            ].map((group) => {
              const isActive = group.items.some((item) => item.path === location.pathname);
              const isExpanded = expandedGroups[group.key];

              return (
                <li key={group.key} className="nav-group">
                  <button
                    type="button"
                    className={`nav-link nav-group-toggle ${isActive ? 'active' : ''}`}
                    aria-expanded={isExpanded}
                    aria-controls={`${group.key}-menu`}
                    onClick={() => toggleGroup(group.key)}
                  >
                    <span className="nav-icon">{group.icon}</span>
                    <span className="nav-text">{group.title}</span>
                    <span className="nav-group-chevron" aria-hidden="true">
                      {isExpanded ? '⌄' : '›'}
                    </span>
                  </button>
                  {isExpanded && (
                    <ul id={`${group.key}-menu`} className="nav-sublist">
                      {renderMenuItems(group.items)}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{user?.displayName?.[0]?.toUpperCase() || '👤'}</div>
            <div className="user-details">
              <span className="user-name">{user?.displayName || user?.email || 'Admin'}</span>
              <span className="user-role">Administrator</span>
            </div>
          </div>
          <button type="button" className="sidebar-logout" onClick={logout}>Đăng xuất</button>
        </div>
      </aside>

      {isSidebarOpen && (
        <button
          type="button"
          className="sidebar-overlay"
          aria-label="Đóng menu"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="main-content">
        <header className="top-header">
          <button
            type="button"
            className="mobile-menu-toggle"
            aria-label={isSidebarOpen ? 'Đóng menu' : 'Mở menu'}
            aria-expanded={isSidebarOpen}
            onClick={toggleSidebar}
          >
            ☰
          </button>
          <div className="header-left">
            <h1 className="page-title">
              {location.pathname === '/settings'
                ? 'Cài đặt thông báo'
                : allMenuItems.find((item) => item.path === location.pathname)?.title || 'Dashboard'}
            </h1>
          </div>
          <div className="header-right">
            <div className="header-actions">
              <div className="notification-menu-wrap">
                <button
                  type="button"
                  className="action-btn notification-trigger"
                  aria-label={unreadCount ? `Thông báo, ${unreadCount} chưa đọc` : 'Thông báo'}
                  aria-expanded={isNotificationOpen}
                  aria-controls="admin-notification-menu"
                  onClick={() => setIsNotificationOpen((isOpen) => !isOpen)}
                >
                  <span aria-hidden="true">🔔</span>
                  {unreadCount > 0 && (
                    <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                  )}
                </button>
                {isNotificationOpen && (
                  <section
                    className="admin-notification-panel"
                    id="admin-notification-menu"
                    aria-label="Danh sách thông báo"
                  >
                    <div className="admin-notification-header">
                      <div>
                        <h2>Thông báo</h2>
                        <small>{unreadCount} thông báo chưa đọc</small>
                      </div>
                      <div className="admin-notification-header-actions">
                        <button type="button" onClick={markAllNotificationsRead} disabled={unreadCount === 0}>
                          Đọc hết
                        </button>
                        <button
                          type="button"
                          onClick={clearReadNotifications}
                          disabled={notifications.every((notification) => !notification.read)}
                          aria-label="Xóa thông báo đã đọc"
                        >
                          Xóa đã đọc
                        </button>
                      </div>
                    </div>
                    {notificationError && (
                      <p className="admin-notification-error" role="status">{notificationError}</p>
                    )}
                    {notifications.length === 0 ? (
                      <div className="admin-notification-empty">
                        <span aria-hidden="true">🔕</span>
                        <p>Chưa có thông báo mới.</p>
                      </div>
                    ) : (
                      <ul className="admin-notification-list">
                        {notifications.map((notification) => (
                          <li key={notification.id}>
                            <Link
                              to={notification.link}
                              className={`admin-notification-item ${notification.read ? 'read' : 'unread'}`}
                              onClick={() => {
                                setNotifications((current) => current.map((item) => item.id === notification.id
                                  ? { ...item, read: true }
                                  : item));
                                setIsNotificationOpen(false);
                              }}
                            >
                              <span className={`admin-notification-icon ${notification.type}`} aria-hidden="true">
                                {notification.type === 'order' ? '🧾' : notification.type === 'contact' ? '✉️' : '📦'}
                              </span>
                              <span className="admin-notification-copy">
                                <strong>{notification.title}</strong>
                                <small>{notification.message}</small>
                                <time>{formatNotificationTime(notification.createdAt)}</time>
                              </span>
                              {!notification.read && <span className="admin-notification-unread-dot" aria-label="Chưa đọc" />}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                )}
              </div>
              <Link to="/settings" className="action-btn" title="Cài đặt thông báo" aria-label="Cài đặt thông báo">
                ⚙️
              </Link>
            </div>
          </div>
        </header>

        <div className="content-area">
          <Outlet context={{ notificationSettings, setNotificationSettings }} />
        </div>
      </main>
    </div>
  );
};

export default SidebarLayout;
