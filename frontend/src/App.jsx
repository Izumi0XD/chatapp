import { useEffect, useRef } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from './store/authStore.js'
import useSocket from './hooks/useSocket.js'
import LoginPage from './pages/LoginPage.jsx'
import SignupPage from './pages/SignupPage.jsx'
import ChatPage from './pages/ChatPage.jsx'
import ProfilePage from './pages/ProfilePage.jsx'

const LoadingScreen = () => (
  <div className="h-screen w-screen flex items-center justify-center bg-gray-900">
    <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
  </div>
)

function App() {
  const { authUser, isCheckingAuth, checkAuth } = useAuthStore()
  const checked = useRef(false)
  useSocket()

  useEffect(() => {
    if (checked.current) return
    checked.current = true
    checkAuth()
  }, [])

  // Request notification permission on load
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  if (isCheckingAuth) return <LoadingScreen />

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900">
      <Routes>
        <Route path="/" element={authUser ? <ChatPage /> : <Navigate to="/login" replace />} />
        <Route path="/login" element={!authUser ? <LoginPage /> : <Navigate to="/" replace />} />
        <Route path="/signup" element={!authUser ? <SignupPage /> : <Navigate to="/" replace />} />
        <Route path="/profile" element={authUser ? <ProfilePage /> : <Navigate to="/login" replace />} />
      </Routes>
    </div>
  )
}

export default App