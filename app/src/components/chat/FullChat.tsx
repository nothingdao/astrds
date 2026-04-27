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
        className='absolute bottom-2 right-2 bg-primary text-primary-foreground px-3 py-1
                   rounded-full shadow-lg animate-bounce hover:bg-card
                   transition-colors z-10 text-sm flex items-center gap-2'
      >
        <span className='w-2 h-2 bg-card rounded-full animate-pulse' />
        New Messages
      </button>
    )
  }

  return (
    <div className='flex flex-col h-full' style={{ minHeight: '480px' }}>
      <div className='px-5 py-3 border-b border-border'>
      </div>

      <div className='flex-1 relative min-h-0'>
        <div
          ref={messagesContainerRef}
          className='absolute inset-0 overflow-y-auto scrollbar-thin scrollbar-thumb-game-blue'
          style={{ paddingBottom: '0.5rem' }}
        >
          <div className='min-h-full flex flex-col justify-end'>
            <div className='space-y-4 px-5 py-3'>
              {messages.length === 0 ? (
                <div className='text-center text-muted-foreground font-mono text-xs py-8'>No messages yet</div>
              ) : (
                messages.map((msg) => {
                  const isOwn = msg.walletAddress === wallet.publicKey?.toString()
                  return (
                    <div
                      key={msg._id}
                      className={`flex items-start gap-3 ${isOwn ? 'opacity-100' : 'opacity-70'}`}
                    >
                      <AvatarDisplay
                        url={avatarUrls[msg.walletAddress]}
                        address={msg.walletAddress}
                        size={28}
                      />
                      <div className='min-w-0'>
                        <div className='flex items-baseline gap-2'>
                          <span className='text-primary font-bold text-sm'>
                            {shortenAddress(msg.walletAddress)}
                          </span>
                          <a
                            href={`https://orbmarkets.io/address/${msg.walletAddress}`}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='text-muted-foreground hover:text-foreground transition-colors text-xs'
                          >
                            ⇗
                          </a>
                          <span className='text-xs text-muted-foreground'>
                            {new Date(msg.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className='text-foreground break-words text-sm'>{msg.message}</p>
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

      <form onSubmit={handleSubmit} className='flex gap-2 px-5 py-3 border-t border-border shrink-0'>
        <input
          type='text'
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder={wallet.connected ? 'Type a message...' : 'Connect wallet to chat'}
          disabled={!wallet.connected || sendingMessage}
          className='flex-1 bg-transparent border border-primary p-2 text-foreground
                     placeholder:text-muted-foreground focus:outline-none focus:border-border
                     disabled:opacity-50 disabled:cursor-not-allowed'
          maxLength={280}
        />
        <button
          type='submit'
          disabled={!wallet.connected || !newMessage.trim() || sendingMessage}
          className='bg-primary text-primary-foreground px-4 py-2 hover:bg-card
                     transition-colors disabled:bg-muted disabled:text-muted-foreground
                     min-w-[80px] flex items-center justify-center'
        >
          {sendingMessage ? (
            <span className='w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin' />
          ) : (
            'Send'
          )}
        </button>
      </form>

      {error && <div className='px-5 pb-2 text-destructive text-xs'>{error}</div>}
    </div>
  )
}

export default FullChat
