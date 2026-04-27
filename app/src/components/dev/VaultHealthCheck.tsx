// src/components/dev/VaultHealthCheck.tsx
// Compares on-chain DepositPool PDAs to Convex records and can sync discrepancies.
import React, { useState } from 'react'
import { useAction } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { CheckCircle2, AlertCircle, XCircle, RefreshCw } from 'lucide-react'

type HealthReport = Awaited<ReturnType<typeof api.vaultHealth.vaultHealthCheck>>
type SyncResult = Awaited<ReturnType<typeof api.vaultHealth.syncVaultToConvex>>

const VaultHealthCheck: React.FC = () => {
  const runHealthCheck = useAction(api.vaultHealth.vaultHealthCheck)
  const syncVault = useAction(api.vaultHealth.syncVaultToConvex)

  const [report, setReport] = useState<HealthReport | null>(null)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const handleCheck = async () => {
    setLoading(true)
    setSyncResult(null)
    try {
      const result = await runHealthCheck({})
      setReport(result)
    } finally {
      setLoading(false)
    }
  }

  const handleSync = async (addresses: string[]) => {
    setSyncing(true)
    try {
      const result = await syncVault({ poolAddresses: addresses })
      setSyncResult(result)
      // Re-run health check to show updated state
      const fresh = await runHealthCheck({})
      setReport(fresh)
    } finally {
      setSyncing(false)
    }
  }

  const allIssueAddresses = report
    ? [
        ...report.missing.map(p => p.address),
        ...report.mismatched.map(p => p.onChain.address),
      ]
    : []

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <div className='font-mono text-[10px] text-muted-foreground uppercase tracking-widest'>
          Vault Health Check
        </div>
        <button
          onClick={handleCheck}
          disabled={loading}
          className='flex items-center gap-1.5 bg-surface-subtle border border-edge-subtle text-tx-secondary hover:text-foreground px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider transition-colors disabled:opacity-40'
        >
          <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Checking...' : 'Run Check'}
        </button>
      </div>

      {report && (
        <div className='space-y-3'>
          {/* Summary row */}
          <div className='grid grid-cols-3 gap-2 text-center'>
            <div className='border border-[var(--text-success)]/20 bg-[var(--text-success)]/5 p-2'>
              <div className='font-mono text-lg text-tx-success'>{report.healthy.length}</div>
              <div className='font-mono text-[9px] text-muted-foreground uppercase tracking-wider'>Healthy</div>
            </div>
            <div className={`border p-2 ${report.mismatched.length > 0 ? 'border-[var(--text-warning)]/30 bg-[var(--text-warning)]/5' : 'border-border'}`}>
              <div className={`font-mono text-lg ${report.mismatched.length > 0 ? 'text-tx-warning' : 'text-tx-dim'}`}>{report.mismatched.length}</div>
              <div className='font-mono text-[9px] text-muted-foreground uppercase tracking-wider'>Mismatch</div>
            </div>
            <div className={`border p-2 ${report.missing.length > 0 ? 'border-destructive/30 bg-destructive/5' : 'border-border'}`}>
              <div className={`font-mono text-lg ${report.missing.length > 0 ? 'text-destructive' : 'text-tx-dim'}`}>{report.missing.length}</div>
              <div className='font-mono text-[9px] text-muted-foreground uppercase tracking-wider'>Missing</div>
            </div>
          </div>

          {/* Missing pools */}
          {report.missing.length > 0 && (
            <div className='border border-destructive/20 bg-destructive/5 p-3 space-y-2'>
              <div className='font-mono text-[10px] text-destructive uppercase tracking-wider flex items-center gap-1.5'>
                <XCircle size={10} /> On-chain only — not in Convex
              </div>
              {report.missing.map(p => (
                <div key={p.address} className='flex justify-between font-mono text-[10px] text-tx-secondary'>
                  <span>{p.mint.slice(0, 12)}…</span>
                  <span className='text-muted-foreground'>{p.depositor.slice(0, 8)}…</span>
                  <span className='text-destructive'>{(p.remaining / 1e6).toLocaleString()} remaining</span>
                </div>
              ))}
            </div>
          )}

          {/* Mismatched pools */}
          {report.mismatched.length > 0 && (
            <div className='border border-[var(--text-warning)]/20 bg-[var(--text-warning)]/5 p-3 space-y-2'>
              <div className='font-mono text-[10px] text-tx-warning uppercase tracking-wider flex items-center gap-1.5'>
                <AlertCircle size={10} /> Balance mismatch
              </div>
              {report.mismatched.map(m => (
                <div key={m.onChain.address} className='font-mono text-[10px] text-tx-secondary'>
                  <span>{m.onChain.mint.slice(0, 12)}…</span>
                  <span className='text-muted-foreground ml-2'>
                    on-chain: {m.onChain.remaining.toLocaleString()} / convex: {m.convexRemaining.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Orphaned */}
          {report.orphaned.length > 0 && (
            <div className='border border-border p-3 space-y-1'>
              <div className='font-mono text-[10px] text-muted-foreground uppercase tracking-wider'>
                In Convex only (no on-chain pool)
              </div>
              {report.orphaned.map(o => (
                <div key={o.id} className='font-mono text-[10px] text-muted-foreground'>
                  {o.symbol} — {o.walletAddress.slice(0, 8)}… ({o.status})
                </div>
              ))}
            </div>
          )}

          {/* All healthy */}
          {report.missing.length === 0 && report.mismatched.length === 0 && (
            <div className='flex items-center gap-2 font-mono text-[10px] text-tx-success'>
              <CheckCircle2 size={10} />
              Convex matches on-chain reality
            </div>
          )}

          {/* Sync button */}
          {allIssueAddresses.length > 0 && (
            <button
              onClick={() => handleSync(allIssueAddresses)}
              disabled={syncing}
              className='w-full bg-primary/20 border border-primary/40 text-primary px-2 py-2 hover:bg-primary/30 transition-colors disabled:opacity-40 font-mono text-[10px] uppercase tracking-wider'
            >
              {syncing ? 'Syncing...' : `Sync ${allIssueAddresses.length} pool${allIssueAddresses.length > 1 ? 's' : ''} from chain`}
            </button>
          )}

          {/* Sync results */}
          {syncResult && (
            <div className='border border-border p-3 space-y-1'>
              {syncResult.results.map((r, i) => (
                <div key={i} className={`font-mono text-[10px] ${r.error ? 'text-destructive' : 'text-tx-success'}`}>
                  {r.error ? '✗' : '✓'} {r.symbol} — {r.action}{r.error ? `: ${r.error}` : ''}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!report && !loading && (
        <p className='font-mono text-[10px] text-tx-dim text-center py-3'>
          Run a check to compare on-chain vault state to Convex records.
        </p>
      )}
    </div>
  )
}

export default VaultHealthCheck
