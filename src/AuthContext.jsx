import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthModalOpen, setAuthModalOpen] = useState(false);
  const [isPricingModalOpen, setPricingModalOpen] = useState(false);

  const ADMIN_EMAILS = ['december2158@gmail.com', 'admin@admin.com'];

  // Initialize from Mock DB (localStorage)
  useEffect(() => {
    const storedUser = localStorage.getItem('crypto_user');
    if (storedUser) {
      let parsedUser = JSON.parse(storedUser);
      // Removed admin auto-subscription temporarily for testing
      setUser(parsedUser);
    }
  }, []);

  const login = (email, password) => {
    // Mock login logic
    const users = JSON.parse(localStorage.getItem('crypto_users_db') || '{}');
    if (users[email] && users[email].password === password) {
      const loggedInUser = users[email];
      setUser(loggedInUser);
      localStorage.setItem('crypto_user', JSON.stringify(loggedInUser));
      setAuthModalOpen(false);
      return true;
    }
    return false;
  };

  const register = (email, password) => {
    const users = JSON.parse(localStorage.getItem('crypto_users_db') || '{}');
    if (users[email]) return false; // Already exists

    const newUser = {
      email,
      password, // In a real app, never store plain text passwords!
      trialStartDate: new Date().toISOString(),
      isSubscribed: false
    };

    users[email] = newUser;
    localStorage.setItem('crypto_users_db', JSON.stringify(users));
    
    setUser(newUser);
    localStorage.setItem('crypto_user', JSON.stringify(newUser));
    setAuthModalOpen(false);
    return true;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('crypto_user');
  };

  const subscribe = (plan) => {
    if (!user) return;
    const updatedUser = { ...user, isSubscribed: true, plan };
    setUser(updatedUser);
    localStorage.setItem('crypto_user', JSON.stringify(updatedUser));
    
    // Update DB
    const users = JSON.parse(localStorage.getItem('crypto_users_db') || '{}');
    users[user.email] = updatedUser;
    localStorage.setItem('crypto_users_db', JSON.stringify(users));
    
    setPricingModalOpen(false);
  };

  const unsubscribe = () => {
    if (!user) return;
    const updatedUser = { 
      ...user, 
      isSubscribed: false,
      trialStartDate: "2000-01-01T00:00:00.000Z" // Expire trial instantly to show locked UI
    };
    delete updatedUser.plan;
    setUser(updatedUser);
    localStorage.setItem('crypto_user', JSON.stringify(updatedUser));
    
    // Update DB
    const users = JSON.parse(localStorage.getItem('crypto_users_db') || '{}');
    users[user.email] = updatedUser;
    localStorage.setItem('crypto_users_db', JSON.stringify(users));
  };

  // Helper to check trial status
  const getTrialStatus = () => {
    if (!user) return { isActive: false, hoursLeft: 0 };
    if (user.isSubscribed) return { isActive: true, hoursLeft: 9999 };

    const start = new Date(user.trialStartDate).getTime();
    const now = new Date().getTime();
    const hoursElapsed = (now - start) / (1000 * 60 * 60);
    const hoursLeft = 24 - hoursElapsed;

    return {
      isActive: hoursLeft > 0,
      hoursLeft: Math.max(0, hoursLeft)
    };
  };

  return (
    <AuthContext.Provider value={{
      user,
      login,
      register,
      logout,
      subscribe,
      unsubscribe,
      getTrialStatus,
      isAuthModalOpen,
      setAuthModalOpen,
      isPricingModalOpen,
      setPricingModalOpen
    }}>
      {children}
    </AuthContext.Provider>
  );
};
