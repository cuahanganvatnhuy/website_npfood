import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import CustomerAccount from './pages/CustomerAccount';
import Navigation from './components/Navigation';
import CustomerChatWidget from './components/CustomerChatWidget';
import Footer from './components/Footer';
import SocialIcons from './components/SocialIcons';
import Home from './pages/Home';
import Products from './pages/Products';
import Cart from './pages/Cart';
import About from './pages/About';
import News from './pages/News';
import NewsDetail from './pages/NewsDetail';
import Contact from './pages/Contact';
import Vouchers from './pages/Vouchers';
import FlashSale from './pages/FlashSale';
import { subscribeToCustomerAuth } from './services/customerAuthService';
import './App.css';

const CART_STORAGE_KEY = 'npfood-cart';

function ScrollToTop() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname, search]);

  return null;
}

const loadCart = () => {
  try {
    const storedCart = JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) || '[]');
    return Array.isArray(storedCart) ? storedCart.filter((item) => item?.id) : [];
  } catch (error) {
    console.error('Không thể đọc giỏ hàng đã lưu:', error);
    return [];
  }
};

function App() {
  const [cartItems, setCartItems] = useState(loadCart);
  const [customerUser, setCustomerUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  useEffect(() => subscribeToCustomerAuth(
    (user) => {
      setCustomerUser(user);
      setAuthReady(true);
    },
    (error) => {
      console.error('Không thể kiểm tra tài khoản khách hàng:', error);
      setAuthReady(true);
    }
  ), []);

  useEffect(() => {
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems.map((item) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        originalPrice: item.originalPrice,
        flashSale: item.flashSale,
        quantity: item.quantity,
        stock: item.stock
      }))));
    } catch (error) {
      console.error('Không thể lưu giỏ hàng:', error);
    }
  }, [cartItems]);

  const addToCart = (product, requestedQuantity = 1) => {
    const quantity = Math.max(1, Math.floor(Number(requestedQuantity) || 1));
    const stock = Number(product.stock) || 0;
    if (stock <= 0) {
      alert('Sản phẩm hiện đã hết hàng.');
      return false;
    }

    const existingItem = cartItems.find((item) => item.id === product.id);
    if ((existingItem?.quantity || 0) + quantity > stock) {
      alert(`Sản phẩm chỉ còn ${stock} món trong kho.`);
      return false;
    }

    const imageUrl = Array.isArray(product.imageUrls) && product.imageUrls.length > 0
      ? product.imageUrls[0]
      : product.imageUrl || '';
    setCartItems((current) => {
      const currentItem = current.find((item) => item.id === product.id);
      if (currentItem) {
        return current.map((item) => item.id === product.id
          ? {
            ...item,
            name: product.name || item.name,
            price: Number(product.price) || 0,
            originalPrice: Number(product.originalPrice ?? product.price) || 0,
            flashSale: product.flashSale || null,
            quantity: item.quantity + quantity,
            stock,
            imageUrl
          }
          : item);
      }
      return [...current, {
        id: product.id,
        name: product.name || 'Sản phẩm',
        price: Number(product.price) || 0,
        originalPrice: Number(product.originalPrice ?? product.price) || 0,
        flashSale: product.flashSale || null,
        quantity,
        stock,
        imageUrl
      }];
    });
    return true;
  };

  const updateCartQuantity = (productId, requestedQuantity) => {
    const item = cartItems.find((cartItem) => cartItem.id === productId);
    if (!item) return;
    const quantity = Math.max(1, Math.floor(Number(requestedQuantity) || 1));
    const stock = Number(item.stock) || 0;
    if (quantity > stock) {
      alert(`Sản phẩm chỉ còn ${stock} món trong kho.`);
      return;
    }
    setCartItems((current) => current.map((cartItem) => cartItem.id === productId
      ? { ...cartItem, quantity }
      : cartItem));
  };

  const removeFromCart = (productId) => {
    setCartItems((current) => current.filter((item) => item.id !== productId));
  };

  const cartCount = cartItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

  return (
    <Router>
      <ScrollToTop />
      <div className="App">
        <Navigation
          cartCount={cartCount}
          user={customerUser}
          isChatOpen={isChatOpen}
          onToggleChat={() => setIsChatOpen((isOpen) => !isOpen)}
        />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home addToCart={addToCart} user={customerUser} />} />
            <Route path="/products" element={<Products addToCart={addToCart} />} />
            <Route path="/vouchers" element={<Vouchers user={customerUser} />} />
            <Route path="/flash-sale" element={<FlashSale addToCart={addToCart} />} />
            <Route
              path="/register"
              element={<CustomerAccount user={customerUser} authReady={authReady} onAuthenticated={setCustomerUser} />}
            />
            <Route
              path="/login"
              element={<CustomerAccount user={customerUser} authReady={authReady} onAuthenticated={setCustomerUser} />}
            />
            <Route
              path="/account"
              element={<CustomerAccount user={customerUser} authReady={authReady} onAuthenticated={setCustomerUser} />}
            />
            <Route path="/courses" element={<Navigate to="/products" replace />} />
            <Route path="/achievements" element={<Navigate to="/products" replace />} />
            <Route
              path="/cart"
              element={(
                <Cart
                  cartItems={cartItems}
                  onUpdateQuantity={updateCartQuantity}
                  onRemove={removeFromCart}
                  onClear={() => setCartItems([])}
                  onSyncCart={setCartItems}
                  user={customerUser}
                  authReady={authReady}
                />
              )}
            />
            <Route path="/about" element={<About />} />
            <Route path="/news" element={<News />} />
            <Route path="/news/:id" element={<NewsDetail />} />
            <Route path="/contact" element={<Contact />} />
          </Routes>
        </main>
        <Footer />
        <SocialIcons onOpenChat={() => setIsChatOpen(true)} />
        {isChatOpen && <CustomerChatWidget user={customerUser} onClose={() => setIsChatOpen(false)} />}
      </div>
    </Router>
  );
}

export default App;
