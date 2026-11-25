import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import SidebarLayout from './components/SidebarLayout.js';
import Dashboard from './pages/Dashboard.js';
import Categories from './pages/Categories.js';
import Products from './pages/Products.js';
import Orders from './pages/Orders.js';
import CustomerAccounts from './pages/CustomerAccounts.js';
import Vouchers from './pages/Vouchers.js';
import LoyaltySettings from './pages/LoyaltySettings.js';
import FlashSales from './pages/FlashSales.js';
import Introduction from './pages/Introduction.js';
import News from './pages/News.js';
import Contact from './pages/Contact.js';
import ContactMessages from './pages/ContactMessages.js';
import Banner from './pages/Banner.js';
import MarketplaceChannels from './pages/MarketplaceChannels.js';
import Settings from './pages/Settings.js';
import PaymentSettings from './pages/PaymentSettings.js';
import Login from './pages/Login.js';
import { AuthProvider, useAuth } from './context/AuthContext.js';

const AdminGuard = () => {
  const { user, loading, isAdminUser, logout } = useAuth();
  if (loading) return <div className="admin-auth-loading">Đang kiểm tra quyền truy cập...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdminUser) {
    return (
      <div className="admin-auth-denied">
        <h1>Không thể truy cập</h1>
        <p>Hãy đăng nhập bằng tài khoản admin@gmail.com.</p>
        <button type="button" onClick={logout}>Đăng xuất</button>
      </div>
    );
  }
  return <Outlet />;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<AdminGuard />}>
            <Route path="/" element={<SidebarLayout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="categories" element={<Categories />} />
              <Route path="products" element={<Products />} />
              <Route path="orders" element={<Orders />} />
              <Route path="customers" element={<CustomerAccounts />} />
              <Route path="vouchers" element={<Vouchers />} />
              <Route path="loyalty" element={<LoyaltySettings />} />
              <Route path="flash-sales" element={<FlashSales />} />
              <Route path="introduction" element={<Introduction />} />
              <Route path="news" element={<News />} />
              <Route path="contact" element={<Contact />} />
              <Route path="contact-messages" element={<ContactMessages />} />
              <Route path="banner" element={<Banner />} />
              <Route path="marketplace-channels" element={<MarketplaceChannels />} />
              <Route path="payment-settings" element={<PaymentSettings />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
