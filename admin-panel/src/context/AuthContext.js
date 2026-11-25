import { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChange, isAdmin, logout } from '../services/authService.js';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdminUser, setIsAdminUser] = useState(false);

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChange(async (currentUser) => {
      if (!active) return;
      setLoading(true);
      setUser(currentUser);
      if (!currentUser) {
        setIsAdminUser(false);
        setLoading(false);
        return;
      }

      try {
        setIsAdminUser(await isAdmin(currentUser));
      } catch (error) {
        console.error('Không thể kiểm tra quyền quản trị:', error);
        setIsAdminUser(false);
      } finally {
        if (active) setLoading(false);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setIsAdminUser(false);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      isAdminUser, 
      logout: handleLogout 
    }}>
      {children}
    </AuthContext.Provider>
  );
};
