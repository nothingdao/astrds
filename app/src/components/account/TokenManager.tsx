// src/components/account/TokenManager.tsx
// Unified token management: view all wallet tokens, launch into Space, burn & close accounts.
import React, { useCallback, useEffect, useState } from 'react'
import { Connection, PublicKey, Transaction } from '@solana/web3.js'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { useMutation } from 'convex/react'
import {
  createBurnCheckedInstruction,
  createCloseAccountInstruction,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import { api } from '../../../convex/_generated/api'
import { getWalletTokens, type WalletToken } from '@/utils/walletTokens'
import { buildSendToSpaceTransaction } from '@/lib/tokenTransfer'
import { RPC_ENDPOINT } from '@/lib/solana'
import { fetchDepositPool, sendSignedTransaction } from '@/lib/spaceVault'
import { isNativeSolMint } from '@/lib/nativeSol'
import { Rocket, Flame, ExternalLink, RefreshCw, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

type View = 'list' | 'configure' | 'launching' | 'launched' | 'launch-error'

const ORB = (addr: string) => `https://orbmarkets.io/address/${addr}?cluster=devnet`
const INPUT = 'w-full bg-background border border-border text-foreground font-mono text-xs px-2.5 py-1.5 focus:border-primary/50 focus:outline-none'

const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className='font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground pt-3 pb-1'>{children}</div>
)

const SummaryRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className='flex items-center justify-between py-1 border-b border-border'>
    <span className='font-mono text-xs text-muted-foreground'>{label}</span>
    <span className='font-mono text-xs text-tx-secondary'>{value}</span>
  </div>
)

const PresetBtn: React.FC<{
  value: string; active: boolean; onClick: () => void; color?: 'blue' | 'purple'
}> = ({ value, active, onClick, color = 'blue' }) => (
  <button onClick={onClick} className={`px-2 py-1 font-mono text-[10px] border transition-colors ${
    active
      ? color === 'blue' ? 'border-primary text-primary' : 'border-[var(--entity-shield)] text-[var(--entity-shield)]'
      : 'border-border text-muted-foreground hover:border-edge-medium hover:text-tx-secondary'
  }`}>{value}</button>
)

const TokenManager: React.FC = () => {
  const { publicKey, signTransaction, signAllTransactions, connected } = useWallet()
  const { connection: walletConn } = useConnection()

  const registerDepositIntent  = useMutation(api.spaceDeposits.registerDepositIntent)
  const confirmDepositFromChain = useMutation(api.spaceDeposits.confirmDepositFromChain)

  // ── List state ─────────────────────────────────────────────────────────────
  const [tokens, setTokens] = useState<WalletToken[]>([])
  const [loadingTokens, setLoadingTokens] = useState(false)
  const [pendingBurn, setPendingBurn] = useState<string | null>(null) // accountAddress awaiting confirm
  const [processing, setProcessing] = useState<Set<string>>(new Set())

  // ── Launch flow state ──────────────────────────────────────────────────────
  const [view, setView] = useState<View>('list')
  const [launchToken, setLaunchToken] = useState<WalletToken | null>(null)
  const [sendAmount, setSendAmount] = useState('')
  const [tokensPerPill, setTokensPerPill] = useState('100')
  const [minLevel, setMinLevel] = useState('1')
  const [maxLevel, setMaxLevel] = useState('10')
  const [spawnMode, setSpawnMode] = useState<'steady' | 'escalating' | 'wave'>('steady')
  const [spawnInterval, setSpawnInterval] = useState('30')
  const [escalationRate, setEscalationRate] = useState('0.1')
  const [waveSize, setWaveSize] = useState('3')
  const [waveCooldown, setWaveCooldown] = useState('60')
  const [launchTxSig, setLaunchTxSig] = useState('')
  const [launchError, setLaunchError] = useState('')

  const loadTokens = useCallback(async () => {
    if (!publicKey) return
    setLoadingTokens(true)
    try {
      const result = await getWalletTokens(publicKey.toString(), true) // include empty accounts
      setTokens(result)
    } finally {
      setLoadingTokens(false)
    }
  }, [publicKey])

  useEffect(() => {
    if (connected) loadTokens()
  }, [connected, loadTokens])

  // ── Burn + close a single account ─────────────────────────────────────────
  const executeBurnClose = async (token: WalletToken) => {
    if (!publicKey || !signTransaction) return
    setPendingBurn(null)
    setProcessing(prev => new Set([...prev, token.accountAddress]))
    try {
      const { blockhash, lastValidBlockHeight } = await walletConn.getLatestBlockhash('confirmed')
      const acct = new PublicKey(token.accountAddress)
      const mint = new PublicKey(token.mintAddress)
      const prog = token.programId === 'TOKEN_2022' ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID
      const tx = new Transaction()
      tx.recentBlockhash = blockhash
      tx.feePayer = publicKey
      if (token.balance > 0) {
        tx.add(createBurnCheckedInstruction(
          acct, mint, publicKey, BigInt(token.balance), token.decimals, [], prog
        ))
      }
      tx.add(createCloseAccountInstruction(acct, publicKey, publicKey, [], prog))
      const signed = await signTransaction(tx)
      const sig = await walletConn.sendRawTransaction(signed.serialize())
      await walletConn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed')
      setTokens(prev => prev.filter(t => t.accountAddress !== token.accountAddress))
    } catch (err) {
      console.error('Burn/close failed:', err)
    } finally {
      setProcessing(prev => { const s = new Set(prev); s.delete(token.accountAddress); return s })
    }
  }

  // ── Batch-close all zero-balance accounts ─────────────────────────────────
  const closeAllEmpty = async () => {
    if (!publicKey || (!signAllTransactions && !signTransaction)) return
    const emptyTokens = tokens.filter(t => t.balance === 0 && !isNativeSolMint(t.mintAddress))
    if (emptyTokens.length === 0) return
    const addrs = emptyTokens.map(t => t.accountAddress)
    setProcessing(prev => new Set([...prev, ...addrs]))
    try {
      const { blockhash, lastValidBlockHeight } = await walletConn.getLatestBlockhash('confirmed')
      const txs = emptyTokens.map(token => {
        const acct = new PublicKey(token.accountAddress)
        const prog = token.programId === 'TOKEN_2022' ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID
        const tx = new Transaction()
        tx.recentBlockhash = blockhash
        tx.feePayer = publicKey
        tx.add(createCloseAccountInstruction(acct, publicKey, publicKey, [], prog))
        return tx
      })
      const signed = signAllTransactions
        ? await signAllTransactions(txs)
        : await Promise.all(txs.map(tx => signTransaction!(tx)))
      for (let i = 0; i < signed.length; i++) {
        try {
          const sig = await walletConn.sendRawTransaction(signed[i].serialize())
          await walletConn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed')
          setTokens(prev => prev.filter(t => t.accountAddress !== emptyTokens[i].accountAddress))
        } catch {
          // individual failure — continue with others
        }
      }
    } finally {
      setProcessing(prev => { const s = new Set(prev); addrs.forEach(a => s.delete(a)); return s })
    }
  }

  // ── Start Space launch for a token ────────────────────────────────────────
  const startLaunch = (token: WalletToken) => {
    setLaunchToken(token)
    const isSol = isNativeSolMint(token.mintAddress)
    setSendAmount(isSol ? Math.min(token.uiBalance / 2, 0.01).toFixed(3).replace(/\.?(0+)$/, '') : String(Math.floor(token.uiBalance / 2)))
    setTokensPerPill(isSol ? '0.001' : '100')
    setView('configure')
  }

  // ── Execute Space launch ──────────────────────────────────────────────────
  const executeLaunch = async () => {
    if (!publicKey || !signTransaction || !launchToken) return
    setView('launching')
    setLaunchError('')
    try {
      const dec = launchToken.decimals
      const rawAmount = Math.floor(parseFloat(sendAmount) * 10 ** dec)
      const rawPerPill = Math.floor(parseFloat(tokensPerPill) * 10 ** dec)
      if (rawAmount <= 0) throw new Error('Invalid amount')
      if (rawPerPill <= 0) throw new Error('Invalid tokens per pill')

      const depositId = await registerDepositIntent({
        walletAddress: publicKey.toString(),
        mintAddress: launchToken.mintAddress,
        programId: launchToken.programId === 'TOKEN_2022' ? 'TOKEN_2022' : 'TOKEN',
        symbol: launchToken.symbol, name: launchToken.name, logoUri: launchToken.logoUri,
        decimals: dec, tokensPerPill: rawPerPill,
        minLevel: parseInt(minLevel), maxLevel: parseInt(maxLevel),
        spawnMode, spawnInterval: parseFloat(spawnInterval),
        escalationRate: spawnMode === 'escalating' ? parseFloat(escalationRate) : undefined,
        waveSize: spawnMode === 'wave' ? parseInt(waveSize) : undefined,
        waveCooldown: spawnMode === 'wave' ? parseInt(waveCooldown) : undefined,
      })

      const built = await buildSendToSpaceTransaction(
        publicKey, launchToken.mintAddress, rawAmount, launchToken.programId
      )
      const conn = new Connection(RPC_ENDPOINT, 'confirmed')
      const signed = await signTransaction(built.transaction)
      const sig = await sendSignedTransaction({
        connection: conn, signedTransaction: signed,
        blockhash: built.blockhash, lastValidBlockHeight: built.lastValidBlockHeight,
      })
      setLaunchTxSig(sig)

      const pool = await fetchDepositPool(conn, built.poolAddress)
      if (!pool) throw new Error('Deposit pool not found')

      await confirmDepositFromChain({
        depositId, txSignature: sig, poolAddress: built.poolAddress.toString(),
        walletAddress: publicKey.toString(), mintAddress: launchToken.mintAddress,
        programId: launchToken.programId, symbol: launchToken.symbol, name: launchToken.name,
        logoUri: launchToken.logoUri, decimals: dec,
        totalAmount: pool.totalDeposited.toNumber(), remainingAmount: pool.remaining.toNumber(),
        tokensPerPill: rawPerPill, minLevel: parseInt(minLevel), maxLevel: parseInt(maxLevel),
        spawnMode, spawnInterval: parseFloat(spawnInterval),
        escalationRate: spawnMode === 'escalating' ? parseFloat(escalationRate) : undefined,
        waveSize: spawnMode === 'wave' ? parseInt(waveSize) : undefined,
        waveCooldown: spawnMode === 'wave' ? parseInt(waveCooldown) : undefined,
        depositedAt: Date.now(),
      })

      setView('launched')
      await loadTokens()
    } catch (err) {
      setLaunchError(err instanceof Error ? err.message : 'Launch failed')
      setView('launch-error')
    }
  }

  if (!connected) {
    return (
      <div className='px-5 py-8 text-center'>
        <p className='font-mono text-xs text-muted-foreground'>Connect wallet to manage tokens</p>
      </div>
    )
  }

  const emptyCount = tokens.filter(t => t.balance === 0 && !isNativeSolMint(t.mintAddress)).length

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className='px-5 pb-5'>

      {/* ── Token list ──────────────────────────────────────────────────────── */}
      {view === 'list' && (
        <div>
          <div className='flex items-center justify-between py-2 border-b border-border'>
            <span className='font-mono text-xs text-muted-foreground'>
              {loadingTokens
                ? 'Loading...'
                : tokens.length === 0
                  ? 'No token accounts'
                  : `${tokens.length} token account${tokens.length !== 1 ? 's' : ''}${emptyCount > 0 ? ` · ${emptyCount} empty` : ''}`
              }
            </span>
            <div className='flex items-center gap-3'>
              {emptyCount > 0 && (
                <button
                  onClick={closeAllEmpty}
                  disabled={processing.size > 0}
                  className='font-mono text-[10px] text-muted-foreground hover:text-tx-secondary border border-border hover:border-edge-medium px-2 py-0.5 transition-colors disabled:opacity-40'
                >
                  close {emptyCount} empty
                </button>
              )}
              <button
                onClick={loadTokens}
                disabled={loadingTokens}
                title='Refresh'
                className='text-tx-dim hover:text-tx-secondary transition-colors'
              >
                <RefreshCw size={11} className={loadingTokens ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {!loadingTokens && tokens.length === 0 && (
            <div className='font-mono text-xs text-tx-tertiary py-8 text-center'>
              No token accounts found
            </div>
          )}

          {tokens.length > 0 && (
            <>
              <div className='flex items-center py-1 border-b border-border'>
                <span className='font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex-1'>Token</span>
                <span className='font-mono text-[10px] uppercase tracking-widest text-muted-foreground w-24 text-right mr-2'>Balance</span>
                <span className='font-mono text-[10px] uppercase tracking-widest text-muted-foreground w-16 text-right'>Actions</span>
              </div>

              {tokens.map(token => {
                const addr = token.accountAddress
                const isProcessing = processing.has(addr)
                const isBurnPending = pendingBurn === addr
                const isEmpty = token.balance === 0
                const isSol = isNativeSolMint(token.mintAddress)

                return (
                  <div key={addr} className='flex items-center py-1.5 border-b border-border min-h-[32px]'>
                    {/* Identity */}
                    <div className='flex items-center gap-2 flex-1 min-w-0'>
                      {token.logoUri ? (
                        <img src={token.logoUri} alt={token.symbol} className='w-4 h-4 rounded-full object-cover shrink-0' />
                      ) : (
                        <div className='w-4 h-4 rounded-full bg-surface-subtle shrink-0 flex items-center justify-center'>
                          <span className='text-[6px] font-mono text-muted-foreground'>{token.symbol.slice(0, 1)}</span>
                        </div>
                      )}
                      <span className='font-mono text-xs text-foreground'>{token.symbol}</span>
                      <span className='font-mono text-xs text-muted-foreground truncate hidden sm:block'>{token.name}</span>
                    </div>

                    {/* Balance */}
                    {!isBurnPending && !isProcessing && (
                      <span className={`font-mono text-xs w-24 text-right mr-2 ${isEmpty ? 'text-tx-dim' : 'text-tx-secondary'}`}>
                        {isEmpty ? 'empty' : token.uiBalance.toLocaleString(undefined, { maximumFractionDigits: isSol ? 9 : 4 })}
                      </span>
                    )}

                    {/* Processing spinner */}
                    {isProcessing && (
                      <div className='flex items-center gap-1.5 mr-2'>
                        <Loader2 size={11} className='text-tx-dim animate-spin' />
                      </div>
                    )}

                    {/* Burn confirm inline */}
                    {isBurnPending && !isProcessing && (
                      <div className='flex items-center gap-2 shrink-0 mr-1'>
                        <span className='font-mono text-[9px] text-destructive/60'>
                          burn {token.uiBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}?
                        </span>
                        <button
                          onClick={() => executeBurnClose(token)}
                          className='font-mono text-[9px] text-destructive hover:text-destructive transition-colors'
                        >
                          yes
                        </button>
                        <button
                          onClick={() => setPendingBurn(null)}
                          className='font-mono text-[9px] text-tx-dim hover:text-tx-secondary transition-colors'
                        >
                          no
                        </button>
                      </div>
                    )}

                    {/* Actions */}
                    {!isProcessing && !isBurnPending && (
                      <div className='flex items-center gap-0.5 shrink-0 w-16 justify-end'>
                        {!isEmpty && (
                          <button
                            onClick={() => startLaunch(token)}
                            title='Launch into Space'
                            className='p-1.5 text-[var(--entity-shield)]/40 hover:text-[var(--entity-shield)] transition-colors'
                          >
                            <Rocket size={11} />
                          </button>
                        )}
                        {!isSol && (
                          <button
                            onClick={() => isEmpty ? executeBurnClose(token) : setPendingBurn(addr)}
                            title={isEmpty ? 'Close account · reclaim rent' : 'Burn balance & close account'}
                            className='p-1.5 text-destructive/35 hover:text-destructive transition-colors'
                          >
                            <Flame size={11} />
                          </button>
                        )}
                        <a
                          href={ORB(token.mintAddress)}
                          target='_blank'
                          rel='noopener noreferrer'
                          title='View on Orb'
                          className='p-1.5 text-tx-dim hover:text-tx-secondary transition-colors'
                        >
                          <ExternalLink size={9} />
                        </a>
                      </div>
                    )}
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}

      {/* ── Configure space launch ──────────────────────────────────────────── */}
      {view === 'configure' && launchToken && (
        <div>
          <div className='flex items-center gap-2 py-2 border-b border-border'>
            {launchToken.logoUri ? (
              <img src={launchToken.logoUri} alt={launchToken.symbol} className='w-5 h-5 rounded-full object-cover shrink-0' />
            ) : (
              <div className='w-5 h-5 rounded-full bg-[var(--entity-shield)]/20 flex items-center justify-center shrink-0'>
                <Rocket size={9} className='text-[var(--entity-shield)]' />
              </div>
            )}
            <span className='font-mono text-xs text-foreground'>{launchToken.symbol}</span>
            <span className='font-mono text-xs text-muted-foreground'>{launchToken.uiBalance.toLocaleString()} available</span>
            <button
              onClick={() => setView('list')}
              className='ml-auto font-mono text-[10px] text-tx-dim hover:text-tx-secondary transition-colors'
            >
              cancel
            </button>
          </div>

          <FieldLabel>Amount to send</FieldLabel>
          <input type='number' value={sendAmount} onChange={e => setSendAmount(e.target.value)}
            max={launchToken.uiBalance} min={isNativeSolMint(launchToken.mintAddress) ? 0.000000001 : 1}
            step={isNativeSolMint(launchToken.mintAddress) ? 0.000000001 : 1} className={INPUT} />

          <FieldLabel>Tokens per pill</FieldLabel>
          <div className='flex gap-1'>
            {(isNativeSolMint(launchToken.mintAddress) ? ['0.001', '0.005', '0.01', '0.05'] : ['10', '100', '500', '1000']).map(v => (
              <PresetBtn key={v} value={v} active={tokensPerPill === v} onClick={() => setTokensPerPill(v)} />
            ))}
            <input type='number' value={tokensPerPill} onChange={e => setTokensPerPill(e.target.value)}
              placeholder='custom'
              className='flex-1 bg-background border border-border text-foreground font-mono text-[10px] px-2 py-1 focus:border-primary/50 focus:outline-none' />
          </div>

          <FieldLabel>Level range</FieldLabel>
          <div className='flex gap-2'>
            <div className='flex-1'>
              <div className='font-mono text-[10px] text-tx-tertiary mb-0.5'>Min</div>
              <input type='number' value={minLevel} onChange={e => setMinLevel(e.target.value)}
                min={1} max={parseInt(maxLevel)} className={INPUT} />
            </div>
            <div className='flex-1'>
              <div className='font-mono text-[10px] text-tx-tertiary mb-0.5'>Max</div>
              <input type='number' value={maxLevel} onChange={e => setMaxLevel(e.target.value)}
                min={parseInt(minLevel)} className={INPUT} />
            </div>
          </div>

          <FieldLabel>Spawn mode</FieldLabel>
          <div className='flex gap-1'>
            {(['steady', 'escalating', 'wave'] as const).map(mode => (
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
          <input type='number'
            value={spawnMode === 'wave' ? waveCooldown : spawnInterval}
            onChange={e => spawnMode === 'wave' ? setWaveCooldown(e.target.value) : setSpawnInterval(e.target.value)}
            min={5} className={INPUT} />

          {spawnMode === 'escalating' && (
            <>
              <FieldLabel>Escalation rate</FieldLabel>
              <div className='flex gap-1'>
                {['0.05', '0.1', '0.2', '0.5'].map(v => (
                  <PresetBtn key={v} value={v} active={escalationRate === v} onClick={() => setEscalationRate(v)} color='purple' />
                ))}
              </div>
            </>
          )}

          {spawnMode === 'wave' && (
            <>
              <FieldLabel>Tokens per wave</FieldLabel>
              <div className='flex gap-1'>
                {['2', '3', '5', '10'].map(v => (
                  <PresetBtn key={v} value={v} active={waveSize === v} onClick={() => setWaveSize(v)} color='purple' />
                ))}
              </div>
            </>
          )}

          <div className='border-t border-border mt-4 pt-1 mb-4'>
            <SummaryRow label='Total'    value={`${parseFloat(sendAmount || '0').toLocaleString()} ${launchToken.symbol}`} />
            <SummaryRow label='Pills'    value={`~${Math.floor(parseFloat(sendAmount || '0') / parseFloat(tokensPerPill || '1'))}`} />
            <SummaryRow label='Per pill' value={`${tokensPerPill} ${launchToken.symbol}`} />
            <SummaryRow label='Levels'   value={`${minLevel}–${maxLevel}`} />
            {spawnMode === 'steady'     && <SummaryRow label='Spawn' value={`every ${spawnInterval}s`} />}
            {spawnMode === 'escalating' && <SummaryRow label='Spawn' value={`${spawnInterval}s base · rate ${escalationRate}`} />}
            {spawnMode === 'wave'       && <SummaryRow label='Spawn' value={`${waveSize} per wave · ${waveCooldown}s cooldown`} />}
          </div>

          <button
            onClick={executeLaunch}
            disabled={!sendAmount || parseFloat(sendAmount) <= 0}
            className='w-full h-9 font-mono text-xs bg-[var(--entity-shield)] text-foreground hover:bg-[var(--entity-shield)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5'
          >
            <Rocket size={11} /> Launch into Space
          </button>
        </div>
      )}

      {/* ── Launching ───────────────────────────────────────────────────────── */}
      {view === 'launching' && (
        <div className='py-12 text-center space-y-3'>
          <Loader2 size={24} className='mx-auto text-[var(--entity-shield)] animate-spin' />
          <p className='font-mono text-xs text-muted-foreground'>Approve in wallet and broadcasting...</p>
        </div>
      )}

      {/* ── Launched ────────────────────────────────────────────────────────── */}
      {view === 'launched' && (
        <div className='py-10 text-center space-y-3'>
          <CheckCircle2 size={24} className='mx-auto text-tx-success' />
          <p className='font-mono text-xs text-foreground'>Tokens launched successfully</p>
          <p className='font-mono text-[10px] text-muted-foreground'>
            {launchToken?.symbol} is now live in the asteroid field
          </p>
          {launchTxSig && (
            <a href={`https://orbmarkets.io/tx/${launchTxSig}?cluster=devnet`} target='_blank' rel='noopener noreferrer'
              className='font-mono text-[10px] text-primary hover:text-foreground transition-colors block'>
              View on Helius Orb ↗
            </a>
          )}
          <button
            onClick={() => { setView('list'); setLaunchToken(null); setLaunchTxSig('') }}
            className='btn-grain mt-2 h-9 px-6 font-mono text-xs bg-primary text-primary-foreground hover:bg-card transition-colors'
          >
            Back to Tokens
          </button>
        </div>
      )}

      {/* ── Launch error ─────────────────────────────────────────────────────── */}
      {view === 'launch-error' && (
        <div className='py-10 text-center space-y-3'>
          <AlertCircle size={24} className='mx-auto text-destructive/80' />
          <p className='font-mono text-xs text-tx-secondary'>{launchError || 'Launch failed'}</p>
          <div className='flex gap-2 justify-center'>
            <button onClick={() => setView('configure')}
              className='h-9 px-4 font-mono text-xs border border-border text-muted-foreground hover:border-edge-medium transition-colors'>
              Try Again
            </button>
            <button onClick={() => setView('list')}
              className='h-9 px-4 font-mono text-xs border border-border text-muted-foreground hover:border-edge-medium transition-colors'>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default TokenManager
