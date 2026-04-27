// src/components/chat/ChatBase.tsx
import React, { useState, useRef, useCallback } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'

const shortenAddress = (address: string) => {
  if (!address || address === 'Anonymous') return 'Anonymous'
  return `${address.slice(0, 4)}...${address.slice(-4)}`
}

export const useChatLogic = () => {
  const [newMessage, setNewMessage] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unreadMessages, setUnreadMessages] = useState(false)
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const wallet = useWallet()

  const messages = useQuery(api.chat.getMessages) ?? []
  const sendMessage = useMutation(api.chat.sendMessage)

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

  return {
    messages,
    newMessage,
    sendingMessage,
    error,
    unreadMessages,
    shouldAutoScroll,
    messagesEndRef,
    messagesContainerRef,
    setNewMessage,
    setShouldAutoScroll,
    setUnreadMessages,
    handleSubmit,
    scrollToBottom,
  }
}

export const MessagesList = ({
  messages,
  messagesContainerRef,
  messagesEndRef,
}: {
  messages: Array<{ _id: string; walletAddress: string; message: string; timestamp: number }>
  messagesContainerRef: React.RefObject<HTMLDivElement>
  messagesEndRef: React.RefObject<HTMLDivElement>
}) => (
  <div className='space-y-4' ref={messagesContainerRef}>
    {messages.map((msg) => (
      <Message key={msg._id} message={msg} />
    ))}
    <div ref={messagesEndRef} />
  </div>
)

export const Message = ({
  message,
}: {
  message: { _id: string; walletAddress: string; message: string; timestamp: number }
}) => {
  const wallet = useWallet()
  const isOwnMessage = message.walletAddress === wallet.publicKey?.toString()

  return (
    <div className={`space-y-1 px-2 ${isOwnMessage ? 'opacity-100' : 'opacity-80'}`}>
      <div className='flex items-baseline gap-2'>
        <span className='text-primary font-bold flex items-center gap-1'>
          {shortenAddress(message.walletAddress)}
          <a
            href={`https://orbmarkets.io/address/${message.walletAddress}`}
            target='_blank'
            rel='noopener noreferrer'
            className='text-muted-foreground hover:text-foreground transition-colors text-3xl mb-5 ml-2 mr-4'
          >
            ⇗
          </a>
        </span>
        <span className='text-xs text-muted-foreground'>
          {new Date(message.timestamp).toLocaleString()}
        </span>
      </div>
      <p className='text-foreground break-words'>{message.message}</p>
    </div>
  )
}

export const ChatInput = ({
  newMessage,
  setNewMessage,
  handleSubmit,
  sendingMessage,
  wallet,
}: {
  newMessage: string
  setNewMessage: (v: string) => void
  handleSubmit: (e: React.FormEvent) => void
  sendingMessage: boolean
  wallet: { connected: boolean }
}) => (
  <form onSubmit={handleSubmit} className='flex gap-2'>
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
)
