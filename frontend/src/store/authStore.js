import { create } from 'zustand'
import axios from '../utils/axios.js'
import toast from 'react-hot-toast'

const useAuthStore = create((set) => ({
  authUser: null,
  isCheckingAuth: true,
  isLoggingIn: false,
  isSigningUp: false,
  isUpdatingProfile: false,

  checkAuth: async () => {
    const token = localStorage.getItem('token')
    if (!token) { set({ authUser: null, isCheckingAuth: false }); return }
    try {
      const { data } = await axios.get('/auth/me')
      set({ authUser: data, isCheckingAuth: false })
    } catch {
      localStorage.removeItem('token')
      set({ authUser: null, isCheckingAuth: false })
    }
  },

  signup: async (formData) => {
    set({ isSigningUp: true })
    try {
      const { data } = await axios.post('/auth/signup', formData)
      localStorage.setItem('token', data.token)
      set({ authUser: data, isSigningUp: false })
      toast.success('Account created!')
      return true
    } catch (error) {
      toast.error(error.response?.data?.message || 'Signup failed')
      set({ isSigningUp: false })
      return false
    }
  },

  login: async (formData) => {
    set({ isLoggingIn: true })
    try {
      const { data } = await axios.post('/auth/login', formData)
      localStorage.setItem('token', data.token)
      set({ authUser: data, isLoggingIn: false })
      toast.success('Welcome back!')
      return true
    } catch (error) {
      toast.error(error.response?.data?.message || 'Login failed')
      set({ isLoggingIn: false })
      return false
    }
  },

  logout: async () => {
    try { await axios.post('/auth/logout') } catch {}
    localStorage.removeItem('token')
    set({ authUser: null })
    toast.success('Logged out')
  },

  updateProfile: async (formData) => {
    set({ isUpdatingProfile: true })
    try {
      // If formData has a file, upload it first
      let avatarUrl = formData.avatar
      if (formData.avatarFile) {
        const fd = new FormData()
        fd.append('file', formData.avatarFile)
        const { data: uploadData } = await axios.post('/upload', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        avatarUrl = uploadData.url
      }
      const { data } = await axios.put('/users/profile', {
        username: formData.username,
        bio: formData.bio,
        avatar: avatarUrl,
      })
      set({ authUser: data, isUpdatingProfile: false })
      toast.success('Profile updated!')
      return true
    } catch (error) {
      toast.error(error.response?.data?.message || 'Update failed')
      set({ isUpdatingProfile: false })
      return false
    }
  },
}))

export default useAuthStore