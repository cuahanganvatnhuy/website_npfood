import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAdmin, loginWithEmail, loginWithGoogle, logout } from '../services/authService.js';
import { useAuth } from '../context/AuthContext.js';
import '../css/AdminLogin.css';

const Login = () => {
  const [email, setEmail] = useState('admin@gmail.com');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { user, isAdminUser } = useAuth();

  useEffect(() => {
    if (user && isAdminUser) navigate('/dashboard', { replace: true });
  }, [user, isAdminUser, navigate]);

  const completeLogin = async (authenticatedUser) => {
    if (!(await isAdmin(authenticatedUser))) {
      await logout();
      throw new Error('Tài khoản này chưa được cấp quyền quản trị.');
    }
    navigate('/dashboard', { replace: true });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await completeLogin(await loginWithEmail(email, password));
    } catch (loginError) {
      console.error('Lỗi đăng nhập quản trị:', loginError);
      setError(loginError.message || 'Đăng nhập thất bại. Vui lòng kiểm tra thông tin.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setSubmitting(true);
    try {
      await completeLogin(await loginWithGoogle());
    } catch (loginError) {
      console.error('Lỗi đăng nhập Google quản trị:', loginError);
      setError(loginError.message || 'Đăng nhập Google thất bại.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="admin-login-page">
      <section className="admin-login-card">
        <div className="admin-login-brand">
          <img className="admin-login-logo" src={`${process.env.PUBLIC_URL}/npfood-logo.png`} alt="NP Food" />
          <div><strong>NP FOOD</strong><small>QUẢN TRỊ CỬA HÀNG</small></div>
        </div>
        <h1>Đăng nhập quản trị</h1>
        <p className="admin-login-description">Đăng nhập bằng tài khoản quản trị.</p>
        {error && <div className="admin-login-error" role="alert">{error}</div>}
        <form onSubmit={handleSubmit}>
          <label>Email<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@gmail.com" required /></label>
          <label>
            Mật khẩu
            <span className="admin-login-password">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <button
                type="button"
                className="admin-login-password-toggle"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                aria-pressed={showPassword}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8" />
                    <path d="M9.9 5.2A10.9 10.9 0 0112 5c5.2 0 8.8 4.5 9.8 6.3a1.3 1.3 0 010 1.4 15 15 0 01-3 3.5M6.2 6.2a15 15 0 00-4 5.1 1.3 1.3 0 000 1.4A11.2 11.2 0 0012 19c1 0 2-.2 2.9-.5" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M2.2 12s3.6-7 9.8-7 9.8 7 9.8 7-3.6 7-9.8 7-9.8-7-9.8-7z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </span>
          </label>
          <button type="submit" className="admin-login-submit" disabled={submitting}>{submitting ? 'Đang đăng nhập...' : 'Đăng nhập'}</button>
        </form>
        <div className="admin-login-divider"><span>hoặc</span></div>
        <button type="button" className="admin-login-google" onClick={handleGoogleLogin} disabled={submitting}>Đăng nhập bằng Google</button>
      </section>
    </main>
  );
};

export default Login;
