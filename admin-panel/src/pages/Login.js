import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAdmin, loginWithEmail, loginWithGoogle, logout } from '../services/authService.js';
import { useAuth } from '../context/AuthContext.js';
import '../css/AdminLogin.css';

const Login = () => {
  const [email, setEmail] = useState('admin@gmail.com');
  const [password, setPassword] = useState('');
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
        <div className="admin-login-brand"><span>NP</span><div><strong>NP FOOD</strong><small>QUẢN TRỊ CỬA HÀNG</small></div></div>
        <h1>Đăng nhập quản trị</h1>
        <p className="admin-login-description">Đăng nhập bằng tài khoản quản trị.</p>
        {error && <div className="admin-login-error" role="alert">{error}</div>}
        <form onSubmit={handleSubmit}>
          <label>Email<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@gmail.com" required /></label>
          <label>Mật khẩu<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          <button type="submit" className="admin-login-submit" disabled={submitting}>{submitting ? 'Đang đăng nhập...' : 'Đăng nhập'}</button>
        </form>
        <div className="admin-login-divider"><span>hoặc</span></div>
        <button type="button" className="admin-login-google" onClick={handleGoogleLogin} disabled={submitting}>Đăng nhập bằng Google</button>
      </section>
    </main>
  );
};

export default Login;
