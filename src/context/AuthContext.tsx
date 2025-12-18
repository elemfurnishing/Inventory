import { createContext, useContext, useState, ReactNode } from 'react';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = import.meta.env.VITE_SHEET_API_URL || "https://script.google.com/macros/s/AKfycbyr8QBIGE3jlMqm3w4r3f-jvRKTJdUKP0Tc4jDITpadSJqQbL8JOC_E6TLXr0xxBJKknA/exec";
const LOGIN_SHEET = import.meta.env.VITE_SHEET_LOGIN_NAME || "Login Master";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('inventory_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [isLoading, setIsLoading] = useState(false);




  const login = async (username: string, password: string): Promise<boolean> => {
    setIsLoading(true);

    
    // Check locally against fetched users
    // Note: The 'users' state might not be updated immediately after await fetchUsers() due to closure? 
    // Actually, fetchUsers updates state asynchronously. 
    // Better to return the data from fetchUsers or use a ref, but simple approach:
    // Let's re-fetch and use local var.
    try {
        console.log('Logging in against:', `${API_URL}?sheet=${LOGIN_SHEET}&action=getData`);
        const response = await fetch(`${API_URL}?sheet=${LOGIN_SHEET}&action=getData`);
        if (response.ok) {
            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                const text = await response.text();
                console.error("Received non-JSON response:", text.substring(0, 200));
                throw new Error("Received non-JSON response from server (check console)");
            }

            const data = await response.json();
            if (data.success && data.data) {
                const sheetData = data.data;
                const parsedUsers: User[] = sheetData.slice(1).map((row: any) => ({
                    username: row[2], // Column C: ID (used for login)
                    displayName: row[1], // Column B: User Name (for display)
                    role: (row[4] || 'user').toLowerCase() as 'admin' | 'user',
                    password: row[3], // Pass
                    pageAccess: row[5] ? String(row[5]).replace(/"/g, '').split(',').map((s: string) => s.trim()) : [],
                }));
                
                const validUser = parsedUsers.find(u => u.username === username && u.password === password);
                if (validUser) {
                    setUser(validUser);
                    localStorage.setItem('inventory_user', JSON.stringify(validUser));
                    setIsLoading(false);
                    return true;
                }
            }
        }
    } catch (e) {
        console.error(e);
    }

    setIsLoading(false);
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('inventory_user');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

