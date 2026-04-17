// src/components/space/SendToSpaceOverlay.tsx
import React, { useEffect, useState, useCallback } from 'react'
import { Connection } from '@solana/web3.js'
import { useWallet } from '@solana/wallet-adapter-react'
import { useAction, useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { Id } from '../../../convex/_generated/dataModel'
import { getWalletTokens, WalletToken } from '@/utils/walletTokens'
import { buildSendToSpaceTransaction } from '@/lib/tokenTransfer'
import { RPC_ENDPOINT } from '@/lib/solana'
import { Rocket, RefreshCw, ChevronRight, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'

// pick → configure → sending (wallet approval + tx) → verifying (waiting for Convex) → done | error
type Step = 'pick' | 'configure' | 'sending' | 'verifying' | 'done' | 'error'

const toUi = (raw: number, decimals: number) =>
  (raw / 10 ** decimals).toLocaleString(undefined, { maximumFractionDigits: 4 })

const VERIFY_TIMEOUT_MS = 45_000

const SendToSpaceOverlay: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const wallet = useWallet()
  const registerDepositIntent = useMutation(api.spaceDeposits.registerDepositIntent)
  const submitDepositTransaction = useMutation(api.spaceDeposits.submitDepositTransaction)
  const verifyAndConfirmDeposit = useAction(api.spaceDepositsActions.verifyAndConfirmDeposit)
  const activeDeposits = useQuery(api.spaceDeposits.getAllActiveSpaceDeposits)

  const [step, setStep] = useState<Step>('pick')
  const [tokens, setTokens] = useState<WalletToken[]>([])
  const [loadingTokens, setLoadingTokens] = useState(false)
  const [selected, setSelected] = useState<WalletToken | null>(null)
  const [sendAmount, setSendAmount] = useState('')
  const [tokensPerPill, setTokensPerPill] = useState('100')
  const [minLevel, setMinLevel] = useState('1')
  const [maxLevel, setMaxLevel] = useState('10')
  const [spawnMode, setSpawnMode] = useState<'steady' | 'escalating' | 'wave'>('steady')
  const [spawnInterval, setSpawnInterval] = useState('30')
  const [escalationRate, setEscalationRate] = useState('0.1')
  const [waveSize, setWaveSize] = useState('3')
  const [waveCooldown, setWaveCooldown] = useState('60')
  const [errorMsg, setErrorMsg] = useState('')
  const [txSig, setTxSig] = useState('')
  const [pendingDepositId, setPendingDepositId] = useState<Id<'spaceDeposits'> | null>(null)
  const [verifyTimedOut, setVerifyTimedOut] = useState(false)

  // Reactive subscription to the pending deposit — fires when webhook activates it.
  const pendingDeposit = useQuery(
    api.spaceDeposits.getDepositById,
    pendingDepositId ? { depositId: pendingDepositId } : 'skip'
  )

  // Advance to done as soon as Convex flips the deposit to active.
  useEffect(() => {
    if (step === 'verifying' && pendingDeposit?.status === 'active') {
      setStep('done')
    }
  }, [step, pendingDeposit])

  // Verification timeout — offer manual retry if webhook doesn't fire.
  useEffect(() => {
    if (step !== 'verifying') return
    const timer = setTimeout(() => setVerifyTimedOut(true), VERIFY_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [step])

  const loadTokens = useCallback(async () => {
    if (!wallet.publicKey) return
    setLoadingTokens(true)
    try {
      const result = await getWalletTokens(wallet.publicKey.toString())
      setTokens(result)
    } catch {
      setTokens([])
    } finally {
      setLoadingTokens(false)
    }
  }, [wallet.publicKey])

  useEffect(() => {
    if (step === 'pick') loadTokens()
  }, [step, loadTokens])

  const handleSelectToken = (token: WalletToken) => {
    setSelected(token)
    setSendAmount(String(Math.floor(token.uiBalance / 2)))
    setStep('configure')
  }

  const handleSend = async () => {
    if (!wallet.publicKey || !wallet.signTransaction || !selected) return
    setStep('sending')
    setErrorMsg('')
    setVerifyTimedOut(false)

    try {
      const decimals = selected.decimals
      const rawAmount = Math.floor(parseFloat(sendAmount) * 10 ** decimals)
      const rawTokensPerPill = Math.floor(parseFloat(tokensPerPill) * 10 ** decimals)

      if (rawAmount <= 0) throw new Error('Invalid send amount')
      if (rawTokensPerPill <= 0) throw new Error('Invalid tokens per pill')

      // Step 1: register intent in Convex BEFORE sending the tx.
      // This gives us a depositId to subscribe to and lets the webhook find
      // the record by txSignature once we attach it.
      const depositId = await registerDepositIntent({
        walletAddress: wallet.publicKey.toString(),
        mintAddress: selected.mintAddress,
        programId: selected.programId === 'TOKEN_2022' ? 'TOKEN_2022' : 'TOKEN',
        symbol: selected.symbol,
        name: selected.name,
        logoUri: selected.logoUri,
        decimals,
        tokensPerPill: rawTokensPerPill,
        minLevel: parseInt(minLevel),
        maxLevel: parseInt(maxLevel),
        spawnMode,
        spawnInterval: parseFloat(spawnInterval),
        escalationRate: spawnMode === 'escalating' ? parseFloat(escalationRate) : undefined,
        waveSize: spawnMode === 'wave' ? parseInt(waveSize) : undefined,
        waveCooldown: spawnMode === 'wave' ? parseInt(waveCooldown) : undefined,
      })
      setPendingDepositId(depositId)

      // Step 2: build, sign, and send the on-chain transfer.
      const tx = await buildSendToSpaceTransaction(
        wallet.publicKey,
        selected.mintAddress,
        rawAmount,
        selected.programId
      )
      const signed = await wallet.signTransaction(tx)
      const connection = new Connection(RPC_ENDPOINT, 'confirmed')
      const sig = await connection.sendRawTransaction(signed.serialize())
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
      await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed')
      setTxSig(sig)

      // Step 3: attach the signature to the pending Convex record so the webhook
      // (and the fallback action) can find it.
      await submitDepositTransaction({ depositId, txSignature: sig })

      // Step 4: verify in parallel — fire the action immediately rather than
      // waiting passively for the webhook. confirmDeposit is idempotent so
      // whichever arrives first (webhook or action) wins with no conflict.
      setStep('verifying')
      verifyAndConfirmDeposit({ depositId }).catch(() => {
        // Action failed — webhook may still fire. Timeout will surface the retry button.
      })
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Transaction failed')
      setStep('error')
    }
  }

  // Manual fallback: if webhook hasn't fired after VERIFY_TIMEOUT_MS, the user
  // can force-verify by triggering the action which reads tx.meta directly.
  const handleForceVerify = async () => {
    if (!pendingDepositId) return
    setVerifyTimedOut(false)
    try {
      await verifyAndConfirmDeposit({ depositId: pendingDepositId })
      // Reactive subscription will flip to done on next Convex update
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Verification failed')
      setStep('error')
    }
  }

  if (!wallet.connected) {
    return (
      <div className='p-10 text-center text-white/40 font-mono text-sm'>
        Connect wallet to launch tokens into space.
      </div>
    )
  }

  return (
    <div className='p-5 space-y-6'>
      {/* ── Pick token ── */}
      {step === 'pick' && (
        <div className='space-y-4'>
          <div className='flex items-center justify-between'>
            <p className='text-xs text-white/40 font-mono'>
              Select a token from your wallet to send into the game world.
            </p>
            <button
              onClick={loadTokens}
              disabled={loadingTokens}
              className='text-white/30 hover:text-white transition-colors'
              title='Refresh'
            >
              <RefreshCw size={14} className={loadingTokens ? 'animate-spin' : ''} />
            </button>
          </div>

          {loadingTokens ? (
            <div className='text-center py-8 text-white/30 font-mono text-xs'>Loading tokens...</div>
          ) : tokens.length === 0 ? (
            <div className='text-center py-8 text-white/30 font-mono text-xs'>
              No tokens found in wallet.
            </div>
          ) : (
            <div className='space-y-2'>
              {tokens.map((t) => (
                <button
                  key={t.mintAddress}
                  onClick={() => handleSelectToken(t)}
                  className='w-full flex items-center justify-between bg-black/30 border border-white/10 rounded-lg p-4 hover:border-game-blue/50 transition-colors text-left'
                >
                  <div className='flex items-center gap-3'>
                    {t.logoUri ? (
                      <img src={t.logoUri} alt={t.symbol} className='w-8 h-8 rounded-full object-cover' />
                    ) : (
                      <div className='w-8 h-8 rounded-full bg-white/10 flex items-center justify-center'>
                        <span className='text-[10px] font-mono text-white/50'>{t.symbol.slice(0, 2)}</span>
                      </div>
                    )}
                    <div>
                      <div className='font-mono text-sm text-white'>{t.symbol}</div>
                      <div className='font-mono text-xs text-white/30'>{t.name}</div>
                    </div>
                  </div>
                  <div className='flex items-center gap-2'>
                    <span className='font-mono text-sm text-game-blue'>
                      {t.uiBalance.toLocaleString()}
                    </span>
                    <ChevronRight size={14} className='text-white/30' />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Configure ── */}
      {step === 'configure' && selected && (
        <div className='space-y-5'>
          <div className='flex items-center gap-3 mb-2'>
            {selected.logoUri ? (
              <img src={selected.logoUri} alt={selected.symbol} className='w-10 h-10 rounded-full object-cover' />
            ) : (
              <div className='w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center'>
                <Rocket size={16} className='text-purple-400' />
              </div>
            )}
            <div>
              <div className='font-mono text-lg text-white'>{selected.symbol}</div>
              <div className='font-mono text-xs text-white/30'>
                Balance: {selected.uiBalance.toLocaleString()}
              </div>
            </div>
          </div>

          <div className='space-y-4'>
            <label className='block'>
              <span className='font-mono text-xs text-white/40 uppercase tracking-wider'>
                Amount to send
              </span>
              <input
                type='number'
                value={sendAmount}
                onChange={(e) => setSendAmount(e.target.value)}
                max={selected.uiBalance}
                min={1}
                className='mt-1 w-full bg-black/50 border border-white/15 text-white font-mono text-sm px-3 py-2 focus:border-game-blue/60 focus:outline-none'
              />
            </label>

            <label className='block'>
              <span className='font-mono text-xs text-white/40 uppercase tracking-wider'>
                Tokens per pill collected
              </span>
              <div className='mt-1 grid grid-cols-4 gap-2'>
                {['10', '100', '500', '1000'].map((v) => (
                  <button
                    key={v}
                    onClick={() => setTokensPerPill(v)}
                    className={`btn-grain font-mono text-xs py-2 transition-colors ${
                      tokensPerPill === v
                        ? 'bg-game-blue text-black'
                        : 'bg-white/10 text-white/50 hover:bg-white/20'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </label>

            <div>
              <span className='font-mono text-xs text-white/40 uppercase tracking-wider'>
                Level range
              </span>
              <div className='mt-1 grid grid-cols-2 gap-3'>
                <label className='block'>
                  <span className='font-mono text-[10px] text-white/30'>Min level</span>
                  <input
                    type='number'
                    value={minLevel}
                    onChange={(e) => setMinLevel(e.target.value)}
                    min={1}
                    max={parseInt(maxLevel)}
                    className='mt-1 w-full bg-black/50 border border-white/15 text-white font-mono text-sm px-3 py-2 focus:border-game-blue/60 focus:outline-none'
                  />
                </label>
                <label className='block'>
                  <span className='font-mono text-[10px] text-white/30'>Max level</span>
                  <input
                    type='number'
                    value={maxLevel}
                    onChange={(e) => setMaxLevel(e.target.value)}
                    min={parseInt(minLevel)}
                    className='mt-1 w-full bg-black/50 border border-white/15 text-white font-mono text-sm px-3 py-2 focus:border-game-blue/60 focus:outline-none'
                  />
                </label>
              </div>
            </div>

            <div>
              <span className='font-mono text-xs text-white/40 uppercase tracking-wider'>
                Spawn mode
              </span>
              <div className='mt-1 grid grid-cols-3 gap-2'>
                {(['steady', 'escalating', 'wave'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setSpawnMode(mode)}
                    className={`btn-grain font-mono text-xs py-2 transition-colors ${
                      spawnMode === mode
                        ? 'bg-purple-500 text-white'
                        : 'bg-white/10 text-white/50 hover:bg-white/20'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              <div className='mt-1 font-mono text-[10px] text-white/30'>
                {spawnMode === 'steady' && 'Fixed interval — equal access for all skill levels'}
                {spawnMode === 'escalating' && 'Faster spawns at higher levels — rewards skilled play'}
                {spawnMode === 'wave' && 'Burst of tokens then quiet — creates exciting moments'}
              </div>
            </div>

            <div>
              <span className='font-mono text-xs text-white/40 uppercase tracking-wider'>
                {spawnMode === 'steady' ? 'Spawn interval (seconds)' : spawnMode === 'escalating' ? 'Base interval (seconds)' : 'Wave cooldown (seconds)'}
              </span>
              <input
                type='number'
                value={spawnMode === 'wave' ? waveCooldown : spawnInterval}
                onChange={(e) => spawnMode === 'wave' ? setWaveCooldown(e.target.value) : setSpawnInterval(e.target.value)}
                min={5}
                className='mt-1 w-full bg-black/50 border border-white/15 text-white font-mono text-sm px-3 py-2 focus:border-game-blue/60 focus:outline-none'
              />
            </div>

            {spawnMode === 'escalating' && (
              <div>
                <span className='font-mono text-xs text-white/40 uppercase tracking-wider'>
                  Escalation rate (0.05–0.5)
                </span>
                <div className='mt-1 grid grid-cols-4 gap-2'>
                  {['0.05', '0.1', '0.2', '0.5'].map((v) => (
                    <button
                      key={v}
                      onClick={() => setEscalationRate(v)}
                      className={`btn-grain font-mono text-xs py-2 transition-colors ${
                        escalationRate === v
                          ? 'bg-purple-500 text-white'
                          : 'bg-white/10 text-white/50 hover:bg-white/20'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <div className='mt-1 font-mono text-[10px] text-white/30'>
                  Higher = faster escalation per level
                </div>
              </div>
            )}

            {spawnMode === 'wave' && (
              <div>
                <span className='font-mono text-xs text-white/40 uppercase tracking-wider'>
                  Tokens per wave
                </span>
                <div className='mt-1 grid grid-cols-4 gap-2'>
                  {['2', '3', '5', '10'].map((v) => (
                    <button
                      key={v}
                      onClick={() => setWaveSize(v)}
                      className={`btn-grain font-mono text-xs py-2 transition-colors ${
                        waveSize === v
                          ? 'bg-purple-500 text-white'
                          : 'bg-white/10 text-white/50 hover:bg-white/20'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className='bg-purple-500/10 border border-purple-500/20 rounded p-3 text-xs font-mono text-purple-300 space-y-1'>
            <div>Total: {parseFloat(sendAmount || '0').toLocaleString()} {selected.symbol}</div>
            <div>Yields ~{Math.floor(parseFloat(sendAmount || '0') / parseFloat(tokensPerPill || '1'))} collectible pills</div>
            <div>{tokensPerPill} {selected.symbol} per pill · Level {minLevel}–{maxLevel}</div>
            {spawnMode === 'steady' && <div>Spawns every {spawnInterval}s per player</div>}
            {spawnMode === 'escalating' && <div>Starts at {spawnInterval}s, speeds up with level (rate {escalationRate})</div>}
            {spawnMode === 'wave' && <div>Bursts of {waveSize} tokens, {waveCooldown}s quiet between waves</div>}
          </div>

          <div className='flex gap-3'>
            <button
              onClick={() => setStep('pick')}
              className='btn-grain flex-1 h-10 font-mono text-xs bg-white/10 text-white/50 hover:bg-white/20 transition-colors'
            >
              Back
            </button>
            <button
              onClick={handleSend}
              disabled={!sendAmount || parseFloat(sendAmount) <= 0}
              className='btn-grain flex-1 h-10 font-mono text-xs bg-purple-500 text-white hover:bg-purple-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2'
            >
              <Rocket size={13} />
              Launch into Space
            </button>
          </div>
        </div>
      )}

      {/* ── Sending (wallet approval + tx broadcast) ── */}
      {step === 'sending' && (
        <div className='py-12 text-center space-y-4'>
          <Rocket size={32} className='mx-auto text-purple-400 animate-bounce' />
          <p className='font-mono text-sm text-white/50'>Approve in wallet and sending...</p>
        </div>
      )}

      {/* ── Verifying (waiting for Helius webhook → Convex) ── */}
      {step === 'verifying' && (
        <div className='py-8 text-center space-y-4'>
          <Loader2 size={32} className='mx-auto text-purple-400 animate-spin' />
          <p className='font-mono text-sm text-white/50'>Verifying on-chain...</p>
          <p className='font-mono text-xs text-white/30'>
            Confirming actual token amount received by treasury.
          </p>
          {txSig && (
            <a
              href={`https://orbmarkets.io/tx/${txSig}?cluster=devnet`}
              target='_blank'
              rel='noopener noreferrer'
              className='font-mono text-xs text-game-blue hover:text-white transition-colors block'
            >
              View transaction ↗
            </a>
          )}
          {verifyTimedOut && (
            <div className='space-y-2 pt-2'>
              <p className='font-mono text-xs text-yellow-400/70'>
                Webhook is taking longer than expected.
              </p>
              <button
                onClick={handleForceVerify}
                className='btn-grain h-9 px-5 font-mono text-xs bg-yellow-400/20 border border-yellow-400/40 text-yellow-400 hover:bg-yellow-400/30 transition-colors'
              >
                Verify Manually
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Done ── */}
      {step === 'done' && (
        <div className='py-8 text-center space-y-4'>
          <CheckCircle2 size={32} className='mx-auto text-green-400' />
          <p className='font-mono text-sm text-white'>Tokens launched successfully!</p>
          <p className='font-mono text-xs text-white/30'>
            {selected?.symbol} tokens are now in space and will appear for players to collect.
          </p>
          {txSig && (
            <a
              href={`https://orbmarkets.io/tx/${txSig}?cluster=devnet`}
              target='_blank'
              rel='noopener noreferrer'
              className='font-mono text-xs text-game-blue hover:text-white transition-colors block'
            >
              View on Helius Orb ↗
            </a>
          )}
          <button
            onClick={() => { setStep('pick'); setSelected(null); setPendingDepositId(null) }}
            className='btn-grain mt-2 h-10 px-6 font-mono text-xs bg-game-blue text-black hover:bg-white transition-colors'
          >
            Launch Another
          </button>
        </div>
      )}

      {/* ── Error ── */}
      {step === 'error' && (
        <div className='py-8 text-center space-y-4'>
          <AlertCircle size={32} className='mx-auto text-game-red' />
          <p className='font-mono text-sm text-white/70'>{errorMsg || 'Something went wrong.'}</p>
          <button
            onClick={() => setStep('configure')}
            className='btn-grain h-10 px-6 font-mono text-xs bg-white/10 text-white/50 hover:bg-white/20 transition-colors'
          >
            Try Again
          </button>
        </div>
      )}

      {/* ── Active deposits info ── */}
      {(step === 'pick' || step === 'done') && activeDeposits && activeDeposits.length > 0 && (
        <div className='border-t border-white/10 pt-4'>
          <p className='font-mono text-xs text-white/30 uppercase tracking-wider mb-3'>
            Currently in Space ({activeDeposits.length})
          </p>
          <div className='space-y-2'>
            {activeDeposits.slice(0, 5).map((d) => (
              <div
                key={d._id}
                className='flex items-center justify-between text-xs font-mono text-white/40'
              >
                <span className='text-white/60'>{d.symbol}</span>
                <span>
                  {toUi(d.remainingAmount, d.decimals ?? 6)} remaining · {toUi(d.tokensPerPill, d.decimals ?? 6)}/pill · L{d.minLevel}–{d.maxLevel}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default SendToSpaceOverlay
