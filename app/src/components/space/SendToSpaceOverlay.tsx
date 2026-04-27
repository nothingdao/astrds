// src/components/space/SendToSpaceOverlay.tsx
import React, { useEffect, useState, useCallback } from 'react'
import { Connection } from '@solana/web3.js'
import { useWallet } from '@solana/wallet-adapter-react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { getWalletTokens, WalletToken } from '@/utils/walletTokens'
import { buildSendToSpaceTransaction } from '@/lib/tokenTransfer'
import { RPC_ENDPOINT } from '@/lib/solana'
import { fetchDepositPool, sendSignedTransaction } from '@/lib/spaceVault'
import { Rocket, RefreshCw, ChevronRight, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'

// pick → configure → sending (wallet approval + tx) → verifying (waiting for Convex) → done | error
type Step = 'pick' | 'configure' | 'sending' | 'verifying' | 'done' | 'error'

const toUi = (raw: number, decimals: number) =>
  (raw / 10 ** decimals).toLocaleString(undefined, { maximumFractionDigits: 4 })

const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className='font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground pt-3 pb-1'>{children}</div>
)

const SummaryRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className='flex items-center justify-between py-1 border-b border-border'>
    <span className='font-mono text-xs text-muted-foreground'>{label}</span>
    <span className='font-mono text-xs text-tx-secondary'>{value}</span>
  </div>
)

const INPUT = 'w-full bg-background border border-border text-foreground font-mono text-xs px-2.5 py-1.5 focus:border-primary/50 focus:outline-none'

const PresetBtn: React.FC<{
  value: string
  active: boolean
  onClick: () => void
  color?: 'blue' | 'purple'
}> = ({ value, active, onClick, color = 'blue' }) => (
  <button
    onClick={onClick}
    className={`px-2 py-1 font-mono text-[10px] border transition-colors ${
      active
        ? color === 'blue'
          ? 'border-primary text-primary'
          : 'border-[var(--entity-shield)] text-[var(--entity-shield)]'
        : 'border-border text-muted-foreground hover:border-edge-medium hover:text-tx-secondary'
    }`}
  >
    {value}
  </button>
)

const SendToSpaceOverlay: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const wallet = useWallet()
  const registerDepositIntent = useMutation(api.spaceDeposits.registerDepositIntent)
  const confirmDepositFromChain = useMutation(api.spaceDeposits.confirmDepositFromChain)
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

    try {
      const decimals = selected.decimals
      const rawAmount = Math.floor(parseFloat(sendAmount) * 10 ** decimals)
      const rawTokensPerPill = Math.floor(parseFloat(tokensPerPill) * 10 ** decimals)

      if (rawAmount <= 0) throw new Error('Invalid send amount')
      if (rawTokensPerPill <= 0) throw new Error('Invalid tokens per pill')

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

      const connection = new Connection(RPC_ENDPOINT, 'confirmed')
      const built = await buildSendToSpaceTransaction(
        wallet.publicKey,
        selected.mintAddress,
        rawAmount,
        selected.programId
      )
      const signed = await wallet.signTransaction(built.transaction)
      const sig = await sendSignedTransaction({
        connection,
        signedTransaction: signed,
        blockhash: built.blockhash,
        lastValidBlockHeight: built.lastValidBlockHeight,
      })
      setTxSig(sig)
      setStep('verifying')

      const pool = await fetchDepositPool(connection, built.poolAddress)
      if (!pool) throw new Error('Deposit pool not found after confirmation')

      await confirmDepositFromChain({
        depositId,
        txSignature: sig,
        poolAddress: built.poolAddress.toString(),
        walletAddress: wallet.publicKey.toString(),
        mintAddress: selected.mintAddress,
        programId: selected.programId,
        symbol: selected.symbol,
        name: selected.name,
        logoUri: selected.logoUri,
        decimals,
        totalAmount: pool.totalDeposited.toNumber(),
        remainingAmount: pool.remaining.toNumber(),
        tokensPerPill: rawTokensPerPill,
        minLevel: parseInt(minLevel),
        maxLevel: parseInt(maxLevel),
        spawnMode,
        spawnInterval: parseFloat(spawnInterval),
        escalationRate: spawnMode === 'escalating' ? parseFloat(escalationRate) : undefined,
        waveSize: spawnMode === 'wave' ? parseInt(waveSize) : undefined,
        waveCooldown: spawnMode === 'wave' ? parseInt(waveCooldown) : undefined,
        depositedAt: Date.now(),
      })

      setStep('done')
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Transaction failed')
      setStep('error')
    }
  }

  if (!wallet.connected) {
    return (
      <div className='p-10 text-center'>
        <p className='font-mono text-xs text-muted-foreground'>Connect wallet to launch tokens into space</p>
      </div>
    )
  }

  return (
    <div className='px-5 pb-5'>

      {/* ── Pick token ── */}
      {step === 'pick' && (
        <div>
          <div className='flex items-center justify-between py-2 border-b border-border'>
            <span className='font-mono text-xs text-muted-foreground'>Select a token to launch into the game world</span>
            <button
              onClick={loadTokens}
              disabled={loadingTokens}
              className='text-tx-dim hover:text-foreground transition-colors ml-3 shrink-0'
              title='Refresh'
            >
              <RefreshCw size={11} className={loadingTokens ? 'animate-spin' : ''} />
            </button>
          </div>

          {loadingTokens ? (
            <div className='font-mono text-xs text-tx-tertiary py-8 text-center'>Loading tokens...</div>
          ) : tokens.length === 0 ? (
            <div className='font-mono text-xs text-tx-tertiary py-8 text-center'>No tokens found in wallet</div>
          ) : (
            <>
              <div className='flex items-center py-1 border-b border-border'>
                <span className='font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex-1'>Token</span>
                <span className='font-mono text-[10px] uppercase tracking-widest text-muted-foreground w-28 text-right'>Balance</span>
              </div>
              {tokens.map((t) => (
                <button
                  key={t.mintAddress}
                  onClick={() => handleSelectToken(t)}
                  className='w-full flex items-center py-2 border-b border-border hover:bg-surface-subtle transition-colors text-left'
                >
                  <div className='flex items-center gap-2 flex-1 min-w-0'>
                    {t.logoUri ? (
                      <img src={t.logoUri} alt={t.symbol} className='w-4 h-4 rounded-full object-cover shrink-0' />
                    ) : (
                      <div className='w-4 h-4 rounded-full bg-surface-subtle flex items-center justify-center shrink-0'>
                        <span className='text-[7px] font-mono text-tx-secondary'>{t.symbol.slice(0, 1)}</span>
                      </div>
                    )}
                    <span className='font-mono text-xs text-foreground'>{t.symbol}</span>
                    <span className='font-mono text-xs text-tx-tertiary truncate'>{t.name}</span>
                  </div>
                  <div className='flex items-center gap-1.5 shrink-0'>
                    <span className='font-mono text-xs text-tx-secondary w-28 text-right'>
                      {t.uiBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                    <ChevronRight size={10} className='text-tx-dim' />
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {/* ── Configure ── */}
      {step === 'configure' && selected && (
        <div>
          {/* Selected token strip */}
          <div className='flex items-center gap-2 py-2 border-b border-border'>
            {selected.logoUri ? (
              <img src={selected.logoUri} alt={selected.symbol} className='w-5 h-5 rounded-full object-cover shrink-0' />
            ) : (
              <div className='w-5 h-5 rounded-full bg-[var(--entity-shield)]/20 flex items-center justify-center shrink-0'>
                <Rocket size={9} className='text-[var(--entity-shield)]' />
              </div>
            )}
            <span className='font-mono text-xs text-foreground'>{selected.symbol}</span>
            <span className='font-mono text-xs text-muted-foreground'>
              {selected.uiBalance.toLocaleString()} available
            </span>
            <button
              onClick={() => setStep('pick')}
              className='ml-auto font-mono text-[10px] text-tx-dim hover:text-tx-secondary transition-colors'
            >
              change
            </button>
          </div>

          <FieldLabel>Amount to send</FieldLabel>
          <input
            type='number'
            value={sendAmount}
            onChange={(e) => setSendAmount(e.target.value)}
            max={selected.uiBalance}
            min={1}
            className={INPUT}
          />

          <FieldLabel>Tokens per pill</FieldLabel>
          <div className='flex gap-1'>
            {['10', '100', '500', '1000'].map((v) => (
              <PresetBtn key={v} value={v} active={tokensPerPill === v} onClick={() => setTokensPerPill(v)} />
            ))}
            <input
              type='number'
              value={tokensPerPill}
              onChange={(e) => setTokensPerPill(e.target.value)}
              placeholder='custom'
              className='flex-1 bg-background border border-border text-foreground font-mono text-[10px] px-2 py-1 focus:border-primary/50 focus:outline-none'
            />
          </div>

          <FieldLabel>Level range</FieldLabel>
          <div className='flex gap-2'>
            <div className='flex-1'>
              <div className='font-mono text-[10px] text-tx-tertiary mb-0.5'>Min</div>
              <input
                type='number'
                value={minLevel}
                onChange={(e) => setMinLevel(e.target.value)}
                min={1}
                max={parseInt(maxLevel)}
                className={INPUT}
              />
            </div>
            <div className='flex-1'>
              <div className='font-mono text-[10px] text-tx-tertiary mb-0.5'>Max</div>
              <input
                type='number'
                value={maxLevel}
                onChange={(e) => setMaxLevel(e.target.value)}
                min={parseInt(minLevel)}
                className={INPUT}
              />
            </div>
          </div>

          <FieldLabel>Spawn mode</FieldLabel>
          <div className='flex gap-1'>
            {(['steady', 'escalating', 'wave'] as const).map((mode) => (
              <PresetBtn key={mode} value={mode} active={spawnMode === mode} onClick={() => setSpawnMode(mode)} color='purple' />
            ))}
          </div>
          <div className='font-mono text-[10px] text-tx-tertiary mt-1'>
            {spawnMode === 'steady'     && 'Fixed interval — equal access for all skill levels'}
            {spawnMode === 'escalating' && 'Faster spawns at higher levels — rewards skilled play'}
            {spawnMode === 'wave'       && 'Burst of tokens then quiet — creates exciting moments'}
          </div>

          <FieldLabel>
            {spawnMode === 'steady' ? 'Interval (sec)' : spawnMode === 'escalating' ? 'Base interval (sec)' : 'Wave cooldown (sec)'}
          </FieldLabel>
          <input
            type='number'
            value={spawnMode === 'wave' ? waveCooldown : spawnInterval}
            onChange={(e) => spawnMode === 'wave' ? setWaveCooldown(e.target.value) : setSpawnInterval(e.target.value)}
            min={5}
            className={INPUT}
          />

          {spawnMode === 'escalating' && (
            <>
              <FieldLabel>Escalation rate</FieldLabel>
              <div className='flex gap-1'>
                {['0.05', '0.1', '0.2', '0.5'].map((v) => (
                  <PresetBtn key={v} value={v} active={escalationRate === v} onClick={() => setEscalationRate(v)} color='purple' />
                ))}
              </div>
            </>
          )}

          {spawnMode === 'wave' && (
            <>
              <FieldLabel>Tokens per wave</FieldLabel>
              <div className='flex gap-1'>
                {['2', '3', '5', '10'].map((v) => (
                  <PresetBtn key={v} value={v} active={waveSize === v} onClick={() => setWaveSize(v)} color='purple' />
                ))}
              </div>
            </>
          )}

          {/* Summary */}
          <div className='border-t border-border mt-4 pt-1 mb-4'>
            <SummaryRow label='Total'    value={`${parseFloat(sendAmount || '0').toLocaleString()} ${selected.symbol}`} />
            <SummaryRow label='Pills'    value={`~${Math.floor(parseFloat(sendAmount || '0') / parseFloat(tokensPerPill || '1'))}`} />
            <SummaryRow label='Per pill' value={`${tokensPerPill} ${selected.symbol}`} />
            <SummaryRow label='Levels'   value={`${minLevel}–${maxLevel}`} />
            {spawnMode === 'steady'     && <SummaryRow label='Spawn' value={`every ${spawnInterval}s`} />}
            {spawnMode === 'escalating' && <SummaryRow label='Spawn' value={`${spawnInterval}s base · rate ${escalationRate}`} />}
            {spawnMode === 'wave'       && <SummaryRow label='Spawn' value={`${waveSize} per wave · ${waveCooldown}s cooldown`} />}
          </div>

          <div className='flex gap-2'>
            <button
              onClick={() => setStep('pick')}
              className='px-4 h-9 font-mono text-xs border border-border text-muted-foreground hover:border-edge-medium hover:text-tx-secondary transition-colors'
            >
              Back
            </button>
            <button
              onClick={handleSend}
              disabled={!sendAmount || parseFloat(sendAmount) <= 0}
              className='flex-1 h-9 font-mono text-xs bg-[var(--entity-shield)] text-foreground hover:bg-[var(--entity-shield)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5'
            >
              <Rocket size={11} />
              Launch into Space
            </button>
          </div>
        </div>
      )}

      {/* ── Sending ── */}
      {step === 'sending' && (
        <div className='py-12 text-center space-y-3'>
          <Rocket size={24} className='mx-auto text-[var(--entity-shield)] animate-bounce' />
          <p className='font-mono text-xs text-muted-foreground'>Approve in wallet and broadcasting...</p>
        </div>
      )}

      {/* ── Verifying ── */}
      {step === 'verifying' && (
        <div className='py-10 text-center space-y-3'>
          <Loader2 size={24} className='mx-auto text-[var(--entity-shield)] animate-spin' />
          <p className='font-mono text-xs text-muted-foreground'>Confirming on-chain deposit...</p>
          <p className='font-mono text-xs text-tx-tertiary'>Reading vault pool state from devnet</p>
          {txSig && (
            <a
              href={`https://orbmarkets.io/tx/${txSig}?cluster=devnet`}
              target='_blank'
              rel='noopener noreferrer'
              className='font-mono text-[10px] text-primary hover:text-foreground transition-colors block'
            >
              View transaction ↗
            </a>
          )}
        </div>
      )}

      {/* ── Done ── */}
      {step === 'done' && (
        <div className='py-10 text-center space-y-3'>
          <CheckCircle2 size={24} className='mx-auto text-tx-success' />
          <p className='font-mono text-xs text-foreground'>Tokens launched successfully</p>
          <p className='font-mono text-[10px] text-muted-foreground'>
            {selected?.symbol} is now live in the asteroid field
          </p>
          {txSig && (
            <a
              href={`https://orbmarkets.io/tx/${txSig}?cluster=devnet`}
              target='_blank'
              rel='noopener noreferrer'
              className='font-mono text-[10px] text-primary hover:text-foreground transition-colors block'
            >
              View on Helius Orb ↗
            </a>
          )}
          <button
            onClick={() => { setStep('pick'); setSelected(null) }}
            className='btn-grain mt-2 h-9 px-6 font-mono text-xs bg-primary text-primary-foreground hover:bg-card transition-colors'
          >
            Launch Another
          </button>
        </div>
      )}

      {/* ── Error ── */}
      {step === 'error' && (
        <div className='py-10 text-center space-y-3'>
          <AlertCircle size={24} className='mx-auto text-destructive/80' />
          <p className='font-mono text-xs text-tx-secondary'>{errorMsg || 'Transaction failed'}</p>
          <button
            onClick={() => setStep('configure')}
            className='btn-grain h-9 px-6 font-mono text-xs border border-border text-muted-foreground hover:border-edge-medium hover:text-tx-secondary transition-colors'
          >
            Try Again
          </button>
        </div>
      )}

      {/* ── Active deposits ── */}
      {(step === 'pick' || step === 'done') && activeDeposits && activeDeposits.length > 0 && (
        <div className='border-t border-border mt-2'>
          <div className='font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground pt-4 pb-1.5'>
            Currently in Space ({activeDeposits.length})
          </div>
          <div className='flex items-center py-1 border-b border-border'>
            <span className='font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex-1'>Token</span>
            <span className='font-mono text-[10px] uppercase tracking-widest text-muted-foreground'>Remaining · Per pill · Levels</span>
          </div>
          {activeDeposits.slice(0, 6).map((d) => (
            <div key={d._id} className='flex items-center py-1.5 border-b border-border'>
              <span className='font-mono text-xs text-tx-secondary flex-1'>{d.symbol}</span>
              <span className='font-mono text-xs text-muted-foreground'>
                {toUi(d.remainingAmount, d.decimals ?? 6)} · {toUi(d.tokensPerPill, d.decimals ?? 6)}/pill · L{d.minLevel}–{d.maxLevel}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default SendToSpaceOverlay
