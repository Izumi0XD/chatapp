import { useEffect, useRef, useState } from 'react'
import useAuthStore from '../store/authStore.js'
import useChatStore from '../store/chatStore.js'
import { getSocket } from '../hooks/useSocket.js'
import MessageBubble from './MessageBubble.jsx'
import TypingIndicator from './TypingIndicator.jsx'
import axios from '../utils/axios.js'
import toast from 'react-hot-toast'

const GIPHY_KEY = 'M5SjFIlAsidQcM08PgDe0wDqleDd7Bzf'

export default function ChatWindow({ onBack }) {
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
  const [callState, setCallState] = useState(null)
  const [callType, setCallType] = useState(null)
  const [incomingCall, setIncomingCall] = useState(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const [showGifPicker, setShowGifPicker] = useState(false)
  const [gifSearch, setGifSearch] = useState('')
  const [gifs, setGifs] = useState([])

  const typingTimeoutRef = useRef(null)
  const bottomRef = useRef(null)
  const fileInputRef = useRef(null)
  const textareaRef = useRef(null)
  const msgSearchDebounce = useRef(null)
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const peerRef = useRef(null)
  const localStreamRef = useRef(null)
  const gifDebounce = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (showGifPicker && gifs.length === 0) searchGifs('')
  }, [showGifPicker])

  useEffect(() => {
    const socket = getSocket()
    if (!socket || !activeConversation) return
    socket.emit('conversation:join', activeConversation._id)
    socket.emit('message:read', { conversationId: activeConversation._id })

    const handleCallSignal = (data) => {
      if (data.type === 'offer') {
        setIncomingCall(data)
        setCallType(data.callType || 'video')
        setCallState('incoming')
      } else if (data.type === 'answer' && peerRef.current) {
        peerRef.current.setRemoteDescription(new RTCSessionDescription(data.signal))
      } else if (data.type === 'ice-candidate' && peerRef.current) {
        peerRef.current.addIceCandidate(new RTCIceCandidate(data.signal))
      } else if (data.type === 'end') {
        endCall(true)
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

  const searchGifs = (q) => {
  clearTimeout(gifDebounce.current)
  gifDebounce.current = setTimeout(async () => {
    try {
      const term = q.trim()
      const endpoint = term
        ? 'https://api.giphy.com/v1/gifs/search?api_key=' + GIPHY_KEY + '&q=' + encodeURIComponent(term) + '&limit=12&rating=g'
        : 'https://api.giphy.com/v1/gifs/trending?api_key=' + GIPHY_KEY + '&limit=12&rating=g'
      const res = await fetch(endpoint)
      const data = await res.json()
      setGifs(data.data || [])
    } catch { setGifs([]) }
  }, 400)
}

  const sendGif = async (gifUrl) => {
    setShowGifPicker(false)
    setGifSearch('')
    setGifs([])
    await sendMessage({
      conversationId: activeConversation._id,
      content: '',
      messageType: 'gif',
      mediaUrl: gifUrl,
    })
  }

  // ── WebRTC ──────────────────────────────────────────────────
  const createPeer = async (isInitiator, targetUserId, type = 'video') => {
    try {
      const constraints = type === 'audio'
        ? { audio: true, video: false }
        : { audio: true, video: true }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      localStreamRef.current = stream

      if (localVideoRef.current && type === 'video') {
        localVideoRef.current.srcObject = stream
      }

      const peer = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ]
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
            callType: type,
            conversationId: activeConversation._id,
          })
        }
      }

      peer.onconnectionstatechange = () => {
        if (peer.connectionState === 'connected') setCallState('active')
        if (['disconnected', 'failed', 'closed'].includes(peer.connectionState)) endCall(true)
      }

      if (isInitiator) {
        const offer = await peer.createOffer()
        await peer.setLocalDescription(offer)
        getSocket()?.emit('call:signal', {
          to: targetUserId,
          signal: offer,
          type: 'offer',
          callType: type,
          conversationId: activeConversation._id,
        })
      }

      return peer
    } catch (err) {
      toast.error('Could not access camera/microphone')
      setCallState(null)
      throw err
    }
  }

  const startCall = async (type) => {
    if (!otherUser) return toast.error('Can only call in 1-on-1 chats')
    setCallType(type)
    setCallState('calling')
    setIsMuted(false)
    setIsCameraOff(false)
    try { await createPeer(true, otherUser._id, type) } catch {}
  }

  const answerCall = async () => {
    if (!incomingCall) return
    setCallState('active')
    setIsMuted(false)
    setIsCameraOff(false)
    try {
      const peer = await createPeer(false, incomingCall.from, callType)
      await peer.setRemoteDescription(new RTCSessionDescription(incomingCall.signal))
      const answer = await peer.createAnswer()
      await peer.setLocalDescription(answer)
      getSocket()?.emit('call:signal', {
        to: incomingCall.from,
        signal: answer,
        type: 'answer',
        callType: callType,
        conversationId: activeConversation._id,
      })
      setIncomingCall(null)
    } catch {}
  }

  const endCall = (skipSignal = false) => {
    if (peerRef.current) { peerRef.current.close(); peerRef.current = null }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop())
      localStreamRef.current = null
    }
    if (localVideoRef.current) localVideoRef.current.srcObject = null
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null

    if (!skipSignal) {
      const target = incomingCall?.from || otherUser?._id
      if (target) {
        getSocket()?.emit('call:signal', {
          to: target, signal: null, type: 'end',
          callType: callType,
          conversationId: activeConversation._id,
        })
      }
    }

    setCallState(null)
    setCallType(null)
    setIncomingCall(null)
    setIsMuted(false)
    setIsCameraOff(false)
  }

  const toggleMute = () => {
    if (!localStreamRef.current) return
    localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !t.enabled })
    setIsMuted(prev => !prev)
  }

  const toggleCamera = () => {
    if (!localStreamRef.current) return
    localStreamRef.current.getVideoTracks().forEach(t => { t.enabled = !t.enabled })
    setIsCameraOff(prev => !prev)
  }

  if (!activeConversation) return null

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white dark:bg-gray-900">

      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3 flex-shrink-0 sticky top-0 z-10 bg-white dark:bg-gray-900">
        <button onClick={onBack}
          className="md:hidden p-2 -ml-1 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-100 flex-shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>

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

        <div className="flex items-center gap-1">
          <button onClick={() => { setShowSearch(!showSearch); if (showSearch) { setMsgSearch(''); clearSearch() } }}
            className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
          </button>

          {!activeConversation.isGroup && otherUser && (
            <button
              onClick={async () => {
                const isBlocked = authUser?.blockedUsers?.includes(otherUser._id)
                try {
                  if (isBlocked) {
                    await axios.post('/users/unblock/' + otherUser._id)
                    toast.success('User unblocked')
                  } else {
                    await axios.post('/users/block/' + otherUser._id)
                    toast.success('User blocked')
                  }
                  useAuthStore.getState().checkAuth()
                } catch { toast.error('Failed') }
              }}
              className={`p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${authUser?.blockedUsers?.includes(otherUser._id) ? 'text-red-500' : 'text-gray-400'}`}
              title={authUser?.blockedUsers?.includes(otherUser._id) ? 'Unblock user' : 'Block user'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
              </svg>
            </button>
          )}

          {!activeConversation.isGroup && (
            <>
              <button onClick={() => startCall('audio')}
                className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" title="Voice call">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                </svg>
              </button>
              <button onClick={() => startCall('video')}
                className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" title="Video call">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Message search bar */}
      {showSearch && (
        <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <input value={msgSearch} onChange={handleMsgSearch} placeholder="Search messages..." autoFocus
            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"/>
          {searchQuery && (
            <p className="text-xs text-gray-400 mt-1 px-1">
              {isSearchingMessages ? 'Searching...' : searchResults.length + ' result' + (searchResults.length !== 1 ? 's' : '')}
            </p>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-0.5 overscroll-contain">
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

      {/* GIF Picker */}
      {showGifPicker && (
        <div className="border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 flex-shrink-0">
          <input
            value={gifSearch}
            onChange={e => { setGifSearch(e.target.value); searchGifs(e.target.value) }}
            placeholder="Search GIFs..."
            className="w-full px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 mb-2"
          />
          <div className="grid grid-cols-3 gap-1 max-h-48 overflow-y-auto">
            {gifs.map(gif => (
  <button key={gif.id} onClick={() => sendGif(gif.images?.original?.url)}
    className="rounded-lg overflow-hidden hover:opacity-80 transition-opacity">
    <img src={gif.images?.fixed_height_small?.url} className="w-full h-20 object-cover"/>
  </button>
))}
            {gifs.length === 0 && gifSearch && (
              <p className="col-span-3 text-center text-gray-400 text-xs py-4">No GIFs found</p>
            )}
          </div>
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

        <button onClick={() => setShowGifPicker(!showGifPicker)}
          className={`p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 flex-shrink-0 text-xs font-bold transition-colors ${showGifPicker ? 'text-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'text-gray-400'}`}>
          GIF
        </button>

        <textarea ref={textareaRef} value={text} onChange={handleTextChange} onKeyDown={handleKeyDown}
          placeholder="Type a message..." rows={1}
          className="flex-1 px-4 py-2.5 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none overflow-hidden"/>
        <button onClick={handleSend} disabled={!text.trim()}
          className="p-2.5 bg-primary-500 hover:bg-primary-600 disabled:opacity-40 text-white rounded-2xl flex-shrink-0 transition-colors">
          <svg className="w-5 h-5 rotate-90" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </div>

      {/* INCOMING CALL */}
      {callState === 'incoming' && incomingCall && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 text-center shadow-2xl w-full max-w-sm">
            <img
              src={incomingCall.fromAvatar || 'https://ui-avatars.com/api/?name=' + incomingCall.fromUsername + '&background=random&size=128'}
              className="w-20 h-20 rounded-full object-cover mx-auto mb-4 border-4 border-primary-100"
            />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">{incomingCall.fromUsername}</h3>
            <p className="text-gray-400 mb-8 flex items-center justify-center gap-2">
              {callType === 'audio'
                ? <><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg> Incoming voice call</>
                : <><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg> Incoming video call</>
              }
            </p>
            <div className="flex gap-6 justify-center">
              <div className="flex flex-col items-center gap-2">
                <button onClick={() => endCall(false)} className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white shadow-lg transition-colors">
                  <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg>
                </button>
                <span className="text-xs text-gray-400">Decline</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <button onClick={answerCall} className="w-16 h-16 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center text-white shadow-lg transition-colors">
                  <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg>
                </button>
                <span className="text-xs text-gray-400">Accept</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVE / CALLING OVERLAY */}
      {(callState === 'active' || callState === 'calling') && (
        <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
          {callType === 'video' ? (
            <div className="relative flex-1 bg-black">
              <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover"/>
              <video ref={localVideoRef} autoPlay playsInline muted className="absolute bottom-4 right-4 w-32 h-24 rounded-2xl object-cover border-2 border-white shadow-xl"/>
              {callState === 'calling' && (
                <div className="absolute inset-0 bg-gray-900/80 flex flex-col items-center justify-center">
                  <img src={otherUser?.avatar || 'https://ui-avatars.com/api/?name=' + otherUser?.username + '&background=random&size=128'}
                    className="w-24 h-24 rounded-full object-cover border-4 border-white mb-4 animate-pulse"/>
                  <p className="text-white text-2xl font-semibold mb-2">{otherUser?.username}</p>
                  <p className="text-gray-300">Calling...</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-b from-gray-800 to-gray-900">
              <img src={otherUser?.avatar || 'https://ui-avatars.com/api/?name=' + otherUser?.username + '&background=random&size=128'}
                className="w-28 h-28 rounded-full object-cover border-4 border-white/20 mb-6 shadow-2xl"/>
              <p className="text-white text-2xl font-semibold mb-2">{otherUser?.username}</p>
              <p className="text-gray-400 text-sm">{callState === 'calling' ? 'Calling...' : 'Voice call in progress'}</p>
              <video ref={remoteVideoRef} autoPlay playsInline className="hidden"/>
              <video ref={localVideoRef} autoPlay playsInline muted className="hidden"/>
            </div>
          )}

          <div className="px-8 py-6 bg-gray-900 flex items-center justify-center gap-6">
            <div className="flex flex-col items-center gap-1">
              <button onClick={toggleMute}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
                {isMuted ? (
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"/>
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
                  </svg>
                )}
              </button>
              <span className="text-xs text-gray-400">{isMuted ? 'Unmute' : 'Mute'}</span>
            </div>

            <div className="flex flex-col items-center gap-1">
              <button onClick={() => endCall(false)}
                className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white shadow-lg transition-colors">
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg>
              </button>
              <span className="text-xs text-gray-400">End</span>
            </div>

            {callType === 'video' && (
              <div className="flex flex-col items-center gap-1">
                <button onClick={toggleCamera}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${isCameraOff ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
                  {isCameraOff ? (
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2zM3 3l18 18"/>
                    </svg>
                  ) : (
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                    </svg>
                  )}
                </button>
                <span className="text-xs text-gray-400">{isCameraOff ? 'Camera off' : 'Camera'}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}