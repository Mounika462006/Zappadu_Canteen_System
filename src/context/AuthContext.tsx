import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { User } from "@/types";
import { toast } from "sonner";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, password: string, sinNumber: string) => Promise<boolean>;
  logout: () => void;
  isShopOwner: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const API_URL = "http://localhost:5000/api";

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize and check token on app load
  useEffect(() => {
    const checkLoggedIn = async () => {
      const token = localStorage.getItem("token");
      if (token) {
        try {
          const res = await fetch(`${API_URL}/auth/me`, {
            headers: {
              "Authorization": `Bearer ${token}`
            }
          });
          if (res.ok) {
            const data = await res.json();
            setUser(data.user);
          } else {
            // Token expired or invalid
            localStorage.removeItem("token");
            setUser(null);
          }
        } catch (error) {
          console.error("Auth initialization failed:", error);
          setUser(null);
        }
      }
      setLoading(false);
    };
    checkLoggedIn();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("token", data.token);
        setUser(data.user);
        toast.success(`Welcome back, ${data.user.name}!`);
        return true;
      } else {
        toast.error(data.error || "Invalid email or password");
        return false;
      }
    } catch (error) {
      console.error("Login call failed:", error);
      toast.error("Network error. Please try again.");
      return false;
    }
  };

  const register = async (
    name: string,
    email: string,
    password: string,
    sinNumber: string
  ): Promise<boolean> => {
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name, email, password, sinNumber })
      });

      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("token", data.token);
        setUser(data.user);
        toast.success("Registration successful! Welcome to Zappadu!");
        return true;
      } else {
        toast.error(data.error || "Registration failed");
        return false;
      }
    } catch (error) {
      console.error("Registration call failed:", error);
      toast.error("Network error. Please try again.");
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
    toast.info("You have been logged out");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        isShopOwner: user?.role === "shop_owner",
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
