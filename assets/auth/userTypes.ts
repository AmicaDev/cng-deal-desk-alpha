export type UserRole = "admin" | "user" | "viewer";

export interface User {
  id: string;
  email: string;
  username: string;
  name: string;
  role: UserRole;
  createdAt: string;
  lastLogin: string | null;
  isActive: boolean;
}

export interface UserCreate {
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
  name: string;
  role: UserRole;
}

export interface UserLogin {
  email: string;
  password: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}
