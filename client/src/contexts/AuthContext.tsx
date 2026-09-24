import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { AxiosError } from 'axios';
import toast from 'react-hot-toast';
import api, { refreshAccessToken, setAccessToken } from '../config/api';

export interface AuthUser {
  _id: string;
  name: string;
  email?: string;
  isAdmin?: boolean;
  isPublic?: boolean;
  profilePhoto?: string | null;
  availableSlots?: number[];
  skillsOffered?: Array<{ _id?: string; name: string; description?: string; proficiency?: string }>;
  skillsWanted?: Array<{ _id?: string; name: string; description?: string; priority?: string }>;
  [key: string]: unknown;
}
interface AuthResult { success: boolean; error?: string; user?: AuthUser }
interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  register: (name: string, email: string, password: string) => Promise<AuthResult>;
  logout: () => void;
  updateUser: (user: AuthUser) => void;
}
const AuthContext = createContext<AuthContextValue | null>(null);
const errorMessage = (error: unknown, fallback: string): string => {
  const responseMessage = (error as AxiosError<{ message?: string }>).response?.data?.message;
  return responseMessage || fallback;
};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Remove bearer tokens from old releases; access credentials now live in memory.
    localStorage.removeItem('token');
    localStorage.removeItem('adminToken');
    let active = true;
    refreshAccessToken()
      .then((token: string) => { setAccessToken(token); return api.get<{ user: AuthUser }>('/auth/me'); })
      .then((response: { data: { user: AuthUser } }) => { if (active) setUser(response.data.user); })
      .catch(() => { if (active) { setAccessToken(null); setUser(null); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function login(email: string, password: string): Promise<AuthResult> {
    try {
      const response = await api.post<{ token: string; user: AuthUser }>('/auth/login', { email, password });
      setAccessToken(response.data.token);
      setUser(response.data.user);
      toast.success(response.data.user.isAdmin ? 'Admin sign-in successful' : 'Login successful!');
      return { success: true, user: response.data.user };
    } catch (error) {
      const message = errorMessage(error, 'Login failed');
      toast.error(message);
      return { success: false, error: message };
    }
  }

  async function register(name: string, email: string, password: string): Promise<AuthResult> {
    try {
      const response = await api.post<{ token: string; user: AuthUser }>('/auth/register', { name, email, password });
      setAccessToken(response.data.token);
      setUser(response.data.user);
      toast.success('Registration successful!');
      return { success: true, user: response.data.user };
    } catch (error) {
      const message = errorMessage(error, 'Registration failed');
      toast.error(message);
      return { success: false, error: message };
    }
  }

  function logout() {
    void api.post('/auth/logout').catch(() => undefined);
    setAccessToken(null);
    setUser(null);
  }

  const value = useMemo<AuthContextValue>(() => ({ user, loading, login, register, logout, updateUser: setUser, isAuthenticated: Boolean(user) }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
