import { useEffect, useRef, useState } from 'react'
import useAuthStore from '../store/authStore.js'
import useChatStore from '../store/chatStore.js'
import { getSocket } from '../hooks/useSocket.js'
import MessageBubble from './MessageBubble.jsx'
import TypingIndicator from './TypingIndicator.jsx'
import axios from '../utils/axios.js'
import toast from 'react-hot-toast'

export default function ChatWindow({ onOpenSidebar }) {
  const { authUser } = useAuthStore()
  const {
    activeConversation, messages, isLoadingMessages,
    sendMessage, typingUsers, onlineUsers = [],
    replyingTo, clearReplyingTo,
    searchMessages, clearSearch, searchQuery, searchResults, isSearchingMessages,
  } = useChatStore()

  const [text, setText] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [msgSearch, setMsgSearch] = useState('')
  const [callState, setCallState] = useState(null) // null | 'calling' | 'incoming' | 'active'
  const [incomingCall, setIncomingCall] = useState(null)

  const typingTimeoutRef = useRef(null)
  const bottomRef = useRef(null)
  const fileInputRef = useRef(null)
  const textareaRef = useRef(null)
  const msgSearchDebounce = useRef(null)

  // Local video/audio refs for WebRTC
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const peerRef = useRef(null)
  const localStreamRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const socket = getSocket()
    if (!socket || !activeConversation) return
    socket.emit('conversation:join', activeConversation._id)
    socket.emit('message:read', { conversationId: activeConversation._id })

    // Listen for incoming calls
    const handleCallSignal = (data) => {
      if (data.type === 'offer') {
        setIncomingCall(data)
        setCallState('incoming')
      } else if (data.type === 'answer' && peerRef.current) {
        peerRef.current.setRemoteDescription(new RTCSessionDescription(data.signal))
      } else if (data.type === 'ice-candidate' && peerRef.current) {
        peerRef.current.addIceCandidate(new RTCIceCandidate(data.signal))
      } else if (data.type === 'end') {
        endCall()
      }
    }

    socket.on('call:signal', handleCallSignal)
    return () => {
      socket.emit('conversation:leave', activeConversation._id)
      socket.off('call:signal', handleCallSignal)
    }
  }, [activeConversation?._id])

  useEffect(() => {
    if (replyingTo) textareaRef.current?.focus()
  }, [replyingTo])

  // Message search debounce
  const handleMsgSearch = (e) => {
    const q = e.target.value
    setMsgSearch(q)
    clearTimeout(msgSearchDebounce.current)
    msgSearchDebounce.current = setTimeout(() => {
      searchMessages(activeConversation._id, q)
    }, 400)
  }

  const otherUser = activeConversation?.isGroup ? null
    : activeConversation?.participants?.find(p => p._id !== authUser?._id)
  const isOtherOnline = otherUser ? onlineUsers.includes(otherUser._id) : false
  const currentTyping = typingUsers?.[activeConversation?._id] || []

  const handleTextChange = (e) => {
    setText(e.target.value)
    const socket = getSocket()
    if (!socket || !activeConversation) return
    socket.emit('typing:start', { conversationId: activeConversation._id })
    clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing:stop', { conversationId: activeConversation._id })
    }, 2000)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  const handleSend = async () => {
    const trimmed = text.trim()
    if (!trimmed || !activeConversation) return
    setText('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    const socket = getSocket()
    socket?.emit('typing:stop', { conversationId: activeConversation._id })
    clearTimeout(typingTimeoutRef.current)
    await sendMessage({
      conversationId: activeConversation._id,
      content: trimmed, messageType: 'text',
      replyTo: replyingTo?._id || null,
    })
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !activeConversation) return
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await axios.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      await sendMessage({
        conversationId: activeConversation._id,
        content: '', messageType: 'image', mediaUrl: data.url,
        replyTo: replyingTo?._id || null,
      })
    } catch { toast.error('Image upload failed') }
    finally { setIsUploading(false); e.target.value = '' }
  }

  // ── WebRTC ─────────────────────────────────────────────────
  const createPeer = async (isInitiator, targetUserId) => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    localStreamRef.current = stream
    if (localVideoRef.current) localVideoRef.current.srcObject = stream

    const peer = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    })
    peerRef.current = peer

    stream.getTracks().forEach(track => peer.addTrack(track, stream))

    peer.ontrack = (e) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0]
    }

    peer.onicecandidate = (e) => {
      if (e.candidate) {
        getSocket()?.emit('call:signal', {
          to: targetUserId,
          signal: e.candidate,
          type: 'ice-candidate',
        })
      }
    }

    if (isInitiator) {
      const offer = await peer.createOffer()
      await peer.setLocalDescription(offer)
      getSocket()?.emit('call:signal', {
        to: targetUserId,
        signal: offer,
        type: 'offer',
      })
    }

    return peer
  }

  const startCall = async () => {
    if (!otherUser) return toast.error('Can only call in 1-on-1 chats')
    setCallState('calling')
    await createPeer(true, otherUser._id)
  }

  const answerCall = async () => {
    if (!incomingCall) return
    setCallState('active')
    const peer = await createPeer(false, incomingCall.from)
    await peer.setRemoteDescription(new RTCSessionDescription(incomingCall.signal))
    const answer = await peer.createAnswer()
    await peer.setLocalDescription(answer)
    getSocket()?.emit('call:signal', {
      to: incomingCall.from,
      signal: answer,
      type: 'answer',
    })
    setIncomingCall(null)
  }

  const endCall = () => {
    if (peerRef.current) { peerRef.current.close(); peerRef.current = null }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop())
      localStreamRef.current = null
    }
    if (incomingCall) {
      getSocket()?.emit('call:signal', { to: incomingCall.from, signal: null, type: 'end' })
    } else if (otherUser) {
      getSocket()?.emit('call:signal', { to: otherUser._id, signal: null, type: 'end' })
    }
    setCallState(null)
    setIncomingCall(null)
  }

  if (!activeConversation) return null

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">

      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3 flex-shrink-0">
        <button onClick={onOpenSidebar} className="md:hidden p-1 text-gray-500">←</button>
        <div className="relative">
          <img
            src={activeConversation.isGroup
              ? (activeConversation.groupAvatar || 'https://ui-avatars.com/api/?name=' + activeConversation.groupName + '&background=random')
              : (otherUser?.avatar || 'https://ui-avatars.com/api/?name=' + otherUser?.username + '&background=random')}
            className="w-9 h-9 rounded-full object-cover"
          />
          {isOtherOnline && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white dark:border-gray-900"/>}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-sm text-gray-900 dark:text-white truncate">
            {activeConversation.isGroup ? activeConversation.groupName : otherUser?.username}
          </h2>
          <p className="text-xs text-gray-400">
            {activeConversation.isGroup ? activeConversation.participants?.length + ' members' : isOtherOnline ? 'Online' : 'Offline'}
          </p>
        </div>

        {/* Header actions */}
        <div className="flex items-center gap-1">
          {/* Message search toggle */}
          <button onClick={() => { setShowSearch(!showSearch); if (showSearch) { setMsgSearch(''); clearSearch() } }}
            className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
          </button>

          {/* Video call (1-on-1 only) */}
          {!activeConversation.isGroup && (
            <button onClick={startCall}
              className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Message search bar */}
      {showSearch && (
        <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <input
            value={msgSearch}
            onChange={handleMsgSearch}
            placeholder="Search messages..."
            autoFocus
            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          {searchQuery && (
            <p className="text-xs text-gray-400 mt-1 px-1">
              {isSearchingMessages ? 'Searching...' : searchResults.length + ' result' + (searchResults.length !== 1 ? 's' : '')}
            </p>
          )}
        </div>
      )}

      {/* Messages OR search results */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-0.5">
        {showSearch && searchQuery ? (
          searchResults.length === 0 ? (
            <div className="text-center text-gray-400 py-12 text-sm">No messages found</div>
          ) : (
            searchResults.map(msg => (
              <div key={msg._id} className="p-3 rounded-xl bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 mb-2">
                <p className="text-xs text-yellow-600 dark:text-yellow-400 mb-1">{msg.sender?.username} · {new Date(msg.createdAt).toLocaleString()}</p>
                <p className="text-sm text-gray-800 dark:text-gray-200">
                  {msg.content.split(new RegExp('(' + searchQuery + ')', 'gi')).map((part, i) =>
                    part.toLowerCase() === searchQuery.toLowerCase()
                      ? <mark key={i} className="bg-yellow-300 dark:bg-yellow-600 rounded px-0.5">{part}</mark>
                      : part
                  )}
                </p>
              </div>
            ))
          )
        ) : isLoadingMessages ? (
          <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"/></div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-400 py-12 text-sm">No messages yet 👋</div>
        ) : (
          messages.map(msg => <MessageBubble key={msg._id} message={msg} />)
        )}
        <TypingIndicator typingUsers={currentTyping.filter(u => u.userId !== authUser?._id)} />
        <div ref={bottomRef} />
      </div>

      {/* Reply preview */}
      {replyingTo && (
        <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
          <div className="flex-1 border-l-4 border-primary-400 pl-3">
            <p className="text-xs font-medium text-primary-500">{replyingTo.sender?.username}</p>
            <p className="text-xs text-gray-500 truncate">{replyingTo.messageType === 'image' ? '📷 Image' : replyingTo.content}</p>
          </div>
          <button onClick={clearReplyingTo} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 flex items-end gap-2 flex-shrink-0">
        <button onClick={() => fileInputRef.current?.click()} disabled={isUploading}
          className="p-2 rounded-xl text-gray-400 hover:text-primary-500 hover:bg-gray-100 dark:hover:bg-gray-700 flex-shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
          </svg>
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload}/>
        <textarea ref={textareaRef} value={text} onChange={handleTextChange} onKeyDown={handleKeyDown}
          placeholder="Type a message..." rows={1}
          className="flex-1 px-4 py-2.5 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none overflow-hidden"/>
        <button onClick={handleSend} disabled={!text.trim()}
          className="p-2.5 bg-primary-500 hover:bg-primary-600 disabled:opacity-40 text-white rounded-2xl flex-shrink-0 transition-colors">
          <svg className="w-5 h-5 rotate-90" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </div>

      {/* Incoming call overlay */}
      {callState === 'incoming' && incomingCall && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 text-center shadow-2xl">
            <div className="w-20 h-20 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-primary-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">{incomingCall.fromUsername}</h3>
            <p className="text-gray-400 mb-8">Incoming video call...</p>
            <div className="flex gap-4 justify-center">
              <button onClick={endCall} className="w-14 h-14 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white">
                <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M19.59 7l-7.59 7.59L4.41 7 3 8.41l9 9 9-9z"/></svg>
              </button>
              <button onClick={answerCall} className="w-14 h-14 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center text-white">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active call / calling overlay */}
      {(callState === 'active' || callState === 'calling') && (
        <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
          <div className="relative flex-1">
            {/* Remote video (full screen) */}
            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover"/>
            {/* Local video (picture-in-picture) */}
            <video ref={localVideoRef} autoPlay playsInline muted className="absolute bottom-4 right-4 w-32 h-24 rounded-2xl object-cover border-2 border-white shadow-lg"/>
            {/* Calling status */}
            {callState === 'calling' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-white">
                  <p className="text-2xl font-semibold mb-2">{otherUser?.username}</p>
                  <p className="text-gray-300 animate-pulse">Calling...</p>
                </div>
              </div>
            )}
          </div>
          {/* End call button */}
          <div className="p-6 flex justify-center bg-gray-900/80 backdrop-blur">
            <button onClick={endCall} className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white shadow-lg">
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}