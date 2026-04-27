// src/components/chat/OverlayChat.tsx
// In-game sidebar chat — game keeps running, no pause.
// C   — toggle visibility (handled in ChatSystem)
// T   — grab keyboard / focus input
// Esc — release keyboard / blur input
// Enter — send message, auto-release keyboard

import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import AvatarDisplay from '@/components/common/AvatarDisplay'

const shorten = (addr: string) =>
  addr && addr !== 'Anonymous'
    ? `${addr.slice(0, 4)}…${addr.slice(-4)}`
    : 'anon'

const OverlayChat: React.FC = () => {
  const wallet = useWallet()
  const inputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [inputFocused, setInputFocused] = useState(false)

  const messages = useQuery(api.chat.getMessages) ?? []
  const sendMessage = useMutation(api.chat.sendMessage)

  const uniqueWallets = useMemo(
    () => [...new Set(messages.map((m) => m.walletAddress))],
    [messages]
  )
  const avatarUrls =
    useQuery(
      api.players.getAvatarUrls,
      uniqueWallets.length > 0 ? { walletAddresses: uniqueWallets } : 'skip'
    ) ?? {}

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  // T — grab keyboard
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) return
      if (e.code === 'KeyT') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      const text = draft.trim()
      if (!text || !wallet.publicKey || sending) return
      setDraft('')
      setSending(true)
      try {
        await sendMessage({
          walletAddress: wallet.publicKey.toString(),
          message: text,
        })
      } catch (err) {
        console.error('chat send failed:', err)
      } finally {
        setSending(false)
        inputRef.current?.blur()
      }
    },
    [draft, wallet.publicKey, sending, sendMessage]
  )

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      setDraft('')
      inputRef.current?.blur()
    }
  }, [])

  return (
    <div
      className='fixed left-0 top-0 bottom-0 z-30 flex flex-col w-64 pointer-events-none select-none'
      style={{
        background:
          'linear-gradient(to right, var(--surface-overlay) 60%, transparent 100%)',
      }}
    >
      {/* Messages — scrollable, pad for HUD strips */}
      <div className='flex-1 overflow-y-auto pt-14 pb-2 px-3 pointer-events-auto flex flex-col justify-end'
        style={{ maskImage: 'linear-gradient(to bottom, transparent 0%, black 18%)' }}
      >
        <div className='space-y-2'>
          {messages.slice(-30).map((msg) => {
            const isOwn = msg.walletAddress === wallet.publicKey?.toString()
            return (
              <div key={msg._id} className='flex items-start gap-2 min-w-0'>
                <AvatarDisplay
                  url={avatarUrls[msg.walletAddress]}
                  address={msg.walletAddress}
                  size={18}
                />
                <div className='min-w-0 leading-tight'>
                  <span
                    className={`text-[11px] font-mono ${isOwn ? 'text-foreground' : 'text-primary'}`}
                  >
                    {shorten(msg.walletAddress)}
                  </span>
                  <span className='text-foreground/75 text-[11px] ml-1 break-words'>
                    {msg.message}
                  </span>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input row */}
      <div className='px-3 pb-14 pointer-events-auto'>
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type='text'
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            placeholder={wallet.connected ? '[T] to chat' : 'connect wallet'}
            disabled={!wallet.connected || sending}
            maxLength={280}
            className='w-full bg-surface-overlay border-b border-primary/40 focus:border-primary
                       text-foreground text-[11px] font-mono px-2 py-1 placeholder:text-tx-dim
                       outline-none disabled:opacity-40 transition-colors'
          />
        </form>
        <p className='text-tx-dim text-[9px] font-mono mt-1'>
          {inputFocused ? '[Enter] send  ·  [Esc] cancel' : '[T] type  ·  [C] close'}
        </p>
      </div>
    </div>
  )
}

export default OverlayChat
