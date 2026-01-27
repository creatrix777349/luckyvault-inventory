import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check for existing session in localStorage
    const savedUser = localStorage.getItem('luckyvault_user')
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser)
        // Verify user still exists and is active
        verifyUser(parsed.id)
      } catch (e) {
        localStorage.removeItem('luckyvault_user')
        setLoading(false)
      }
    } else {
      setLoading(false)
    }
  }, [])

  const verifyUser = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .eq('active', true)
        .single()
      
      if (data && !error) {
        setUser(data)
        localStorage.setItem('luckyvault_user', JSON.stringify(data))
      } else {
        localStorage.removeItem('luckyvault_user')
      }
    } catch (e) {
      localStorage.removeItem('luckyvault_user')
    } finally {
      setLoading(false)
    }
  }

  const login = async (pin) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('pin', pin)
        .eq('active', true)
        .single()
      
      if (error || !data) {
        return { success: false, error: 'Invalid PIN' }
      }

      setUser(data)
      localStorage.setItem('luckyvault_user', JSON.stringify(data))
      return { success: true, user: data }
    } catch (e) {
      return { success: false, error: 'Login failed' }
    }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('luckyvault_user')
  }

  const hasAccess = (path) => {
    if (!user) return false
    if (user.role === 'Admin') return true
    
    const allowedPages = user.allowed_pages || []
    return allowedPages.includes(path)
  }

  const isAdmin = () => {
    return user?.role === 'Admin'
  }

  const verifyAdminPin = async (pin) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('pin', pin)
        .eq('role', 'Admin')
        .eq('active', true)
        .single()
      
      return !error && data
    } catch (e) {
      return false
    }
  }

  // Refresh user data (after permissions change)
  const refreshUser = async () => {
    if (user?.id) {
      await verifyUser(user.id)
    }
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      login, 
      logout, 
      hasAccess, 
      isAdmin,
      verifyAdminPin,
      refreshUser
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
