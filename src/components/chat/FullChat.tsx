// src/components/chat/FullChat.tsx
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { ChatProps } from '@/types/chat'
import AvatarDisplay from '@/components/common/AvatarDisplay'

const shortenAddress = (address: string) => {
  if (!address || address === 'Anonymous') return 'Anonymous'
  return `${address.slice(0, 4)}...${address.slice(-4)}`
}

const FullChat: React.FC<ChatProps> = ({ onClose }) => {
  const wallet = useWallet()
  const [newMessage, setNewMessage] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unreadMessages, setUnreadMessages] = useState(false)
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  const messages = useQuery(api.chat.getMessages) ?? []
  const sendMessage = useMutation(api.chat.sendMessage)

  const uniqueWallets = useMemo(
    () => [...new Set(messages.map((m) => m.walletAddress))],
    [messages]
  )
  const avatarUrls = useQuery(
    api.players.getAvatarUrls,
    uniqueWallets.length > 0 ? { walletAddresses: uniqueWallets } : 'skip'
  ) ?? {}

  const scrollToBottom = useCallback(
    (force = false) => {
      if (messagesEndRef.current && (shouldAutoScroll || force)) {
        messagesEndRef.current.scrollIntoView({
          behavior: force ? 'auto' : 'smooth',
        })
      }
    },
    [shouldAutoScroll]
  )

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight)
    if (distanceFromBottom < 100) {
      setShouldAutoScroll(true)
      setUnreadMessages(false)
    } else {
      setShouldAutoScroll(false)
    }
  }, [])

  useEffect(() => {
    const container = messagesContainerRef.current
    if (container) {
      container.addEventListener('scroll', handleScroll)
      return () => container.removeEventListener('scroll', handleScroll)
    }
  }, [handleScroll])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !wallet.connected || sendingMessage || !wallet.publicKey) return

    const messageText = newMessage.trim()
    setNewMessage('')
    setSendingMessage(true)
    setShouldAutoScroll(true)

    try {
      await sendMessage({ walletAddress: wallet.publicKey.toString(), message: messageText })
      setSendingMessage(false)
    } catch (err) {
      console.error('Error sending message:', err)
      setError('Failed to send message. Please try again.')
      setNewMessage(messageText)
      setSendingMessage(false)
    }
  }

  const NewMessagesIndicator = () => {
    if (!unreadMessages || shouldAutoScroll) return null
    return (
      <button
        onClick={() => {
          setShouldAutoScroll(true)
          setUnreadMessages(false)
          scrollToBottom(true)
        }}
        className='absolute bottom-2 right-2 bg-game-blue text-black px-3 py-1
                   rounded-full shadow-lg animate-bounce hover:bg-white
                   transition-colors z-10 text-sm flex items-center gap-2'
      >
        <span className='w-2 h-2 bg-white rounded-full animate-pulse' />
        New Messages
      </button>
    )
  }

  return (
    <div className='max-w-2xl w-full mx-auto h-[80vh] top-20 mt-10 flex flex-col bg-black border border-game-blue p-6'>
      <button
        onClick={onClose}
        className='absolute top-4 right-4 text-gray-400 hover:text-white transition-colors'
      >
        <span className='text-2xl'>✕</span>
      </button>

      <div className='flex justify-between items-center mb-4 mt-12'>
        <h2 className='text-xl text-game-blue'>Game Chat</h2>
      </div>

      <div className='flex-1 relative'>
        <div
          ref={messagesContainerRef}
          className='absolute inset-0 overflow-y-auto scrollbar-thin scrollbar-thumb-game-blue'
          style={{ paddingBottom: '0.5rem' }}
        >
          <div className='min-h-full flex flex-col justify-end'>
            <div className='space-y-4'>
              {messages.length === 0 ? (
                <div className='text-center text-gray-500'>No messages yet</div>
              ) : (
                messages.map((msg) => {
                  const isOwn = msg.walletAddress === wallet.publicKey?.toString()
                  return (
                    <div
                      key={msg._id}
                      className={`flex items-start gap-3 px-2 ${isOwn ? 'opacity-100' : 'opacity-80'}`}
                    >
                      <AvatarDisplay
                        url={avatarUrls[msg.walletAddress]}
                        address={msg.walletAddress}
                        size={28}
                      />
                      <div className='min-w-0'>
                        <div className='flex items-baseline gap-2'>
                          <span className='text-game-blue font-bold text-sm'>
                            {shortenAddress(msg.walletAddress)}
                          </span>
                          <a
                            href={`https://orbmarkets.io/address/${msg.walletAddress}`}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='text-gray-500 hover:text-white transition-colors text-xs'
                          >
                            ⇗
                          </a>
                          <span className='text-xs text-gray-500'>
                            {new Date(msg.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className='text-white break-words text-sm'>{msg.message}</p>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>
        <NewMessagesIndicator />
      </div>

      <form onSubmit={handleSubmit} className='flex gap-2'>
        <input
          type='text'
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder={wallet.connected ? 'Type a message...' : 'Connect wallet to chat'}
          disabled={!wallet.connected || sendingMessage}
          className='flex-1 bg-transparent border border-game-blue p-2 text-white
                     placeholder:text-gray-500 focus:outline-none focus:border-white
                     disabled:opacity-50 disabled:cursor-not-allowed'
          maxLength={280}
        />
        <button
          type='submit'
          disabled={!wallet.connected || !newMessage.trim() || sendingMessage}
          className='bg-game-blue text-black px-4 py-2 hover:bg-white
                     transition-colors disabled:bg-gray-700 disabled:text-gray-500
                     min-w-[80px] flex items-center justify-center'
        >
          {sendingMessage ? (
            <span className='w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin' />
          ) : (
            'Send'
          )}
        </button>
      </form>

      {error && <div className='mt-2 text-red-500 text-sm text-center'>{error}</div>}
    </div>
  )
}

export default FullChat
