// ============================================================
// YesGo Admin — Auth Store (React Context + useReducer)
// ============================================================
import React, { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';
import { api } from '@/lib/api';
import type { UserInfo, TenantInfo } from '@/types';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserInfo | null;
  tenant: TenantInfo | null;
  error: string | null;
}

type AuthAction =
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; user: UserInfo; tenant: TenantInfo }
  | { type: 'LOGIN_FAILURE'; error: string }
  | { type: 'LOGOUT' }
  | { type: 'SET_LOADING'; isLoading: boolean };

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'LOGIN_START':
      return { ...state, isLoading: true, error: null };
    case 'LOGIN_SUCCESS':
      return { isAuthenticated: true, isLoading: false, user: action.user, tenant: action.tenant, error: null };
    case 'LOGIN_FAILURE':
      return { ...state, isLoading: false, error: action.error };
    case 'LOGOUT':
      return { isAuthenticated: false, isLoading: false, user: null, tenant: null, error: null };
    case 'SET_LOADING':
      return { ...state, isLoading: action.isLoading };
    default:
      return state;
  }
}

interface AuthContextValue {
  state: AuthState;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, {
    isAuthenticated: false,
    isLoading: true,
    user: null,
    tenant: null,
    error: null,
  });

  // Check existing token on mount
  useEffect(() => {
    const token = api.getToken();
    if (!token) {
      dispatch({ type: 'SET_LOADING', isLoading: false });
      return;
    }
    api.me()
      .then((res) => {
        const data = res.data as unknown as { user: UserInfo; tenant: TenantInfo };
        dispatch({
          type: 'LOGIN_SUCCESS',
          user: data.user,
          tenant: data.tenant,
        });
      })
      .catch(() => {
        api.setToken(null);
        dispatch({ type: 'LOGOUT' });
        dispatch({ type: 'SET_LOADING', isLoading: false });
      });
  }, []);

  const login = async (username: string, password: string) => {
    dispatch({ type: 'LOGIN_START' });
    try {
      const res = await api.login(username, password);
      dispatch({
        type: 'LOGIN_SUCCESS',
        user: res.data.user as unknown as UserInfo,
        tenant: res.data.tenant as TenantInfo,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '登录失败';
      dispatch({ type: 'LOGIN_FAILURE', error: message });
      throw err;
    }
  };

  const logout = () => {
    api.setToken(null);
    dispatch({ type: 'LOGOUT' });
  };

  return (
    <AuthContext.Provider value={{ state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
