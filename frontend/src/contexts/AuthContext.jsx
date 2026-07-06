import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentWarehouse, setCurrentWarehouse] = useState(null);
  const [availableWarehouses, setAvailableWarehouses] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const navigate = useNavigate();

  const loadUserAndWarehouses = useCallback(async () => {
    const user = await api.get('/auth/me').then((r) => r.data);
    setCurrentUser(user);
    const whs = await api.get('/warehouses').then((r) => r.data);
    setAvailableWarehouses(whs);
    const savedId = localStorage.getItem('sf_warehouse_id');
    const selected = whs.find((w) => w.id === savedId) || whs[0] || null;
    if (selected) {
      setCurrentWarehouse(selected);
      localStorage.setItem('sf_warehouse_id', selected.id);
    }
    return user;
  }, []);

  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem('sf_token');
      if (token) {
        try { await loadUserAndWarehouses(); } catch { localStorage.removeItem('sf_token'); }
      }
      setInitialLoading(false);
    };
    init();
  }, [loadUserAndWarehouses]);

  const login = async (username, password) => {
    const { data } = await api.post('/auth/login', { username, password });
    localStorage.setItem('sf_token', data.token);
    await loadUserAndWarehouses();
    navigate('/dashboard');
  };

  const logout = () => {
    localStorage.removeItem('sf_token');
    localStorage.removeItem('sf_warehouse_id');
    setCurrentUser(null);
    setCurrentWarehouse(null);
    setAvailableWarehouses([]);
    navigate('/');
  };

  const switchWarehouse = (warehouseId) => {
    const selected = availableWarehouses.find((w) => w.id === warehouseId);
    if (selected) {
      setCurrentWarehouse(selected);
      localStorage.setItem('sf_warehouse_id', selected.id);
    }
  };

  const refreshWarehouses = async () => {
    const whs = await api.get('/warehouses').then((r) => r.data);
    setAvailableWarehouses(whs);
    if (!whs.find((w) => w.id === currentWarehouse?.id) && whs.length) {
      setCurrentWarehouse(whs[0]);
      localStorage.setItem('sf_warehouse_id', whs[0].id);
    }
  };

  const canEditData = () => ['owner', 'manager'].includes(currentUser?.role);
  const canManageUsers = () => currentUser?.role === 'owner';
  const canManageWarehouses = () => currentUser?.role === 'owner';

  const value = {
    currentUser,
    currentWarehouse,
    availableWarehouses,
    isAuthenticated: !!currentUser,
    login,
    logout,
    switchWarehouse,
    refreshWarehouses,
    canEditData,
    canManageUsers,
    canManageWarehouses,
  };

  if (initialLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground font-medium animate-pulse">Loading workspace...</p>
        </div>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
