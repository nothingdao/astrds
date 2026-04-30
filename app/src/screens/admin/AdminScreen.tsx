import React, { useCallback, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { isDevWallet } from "@/config/devWallets";
import LevelBandEditor from "./LevelBandEditor";
import DevTools from "@/components/dev/DevTools";
import SoundManager from "./SoundManager";
import { useArrowTabNav } from "@/hooks/useArrowTabNav";
import {
  normalizeGameConfig,
  type GameConfig,
} from "../../../../shared/game/gameConfigContract";

type ConfigFields = GameConfig;

type AdminTab = "config" | "bands" | "sound" | "dev";

const TABS: { id: AdminTab; label: string; devOnly?: boolean }[] = [
  { id: "config", label: "Config" },
  { id: "bands", label: "Level Bands" },
  { id: "sound", label: "Sound" },
  { id: "dev", label: "Dev Tools", devOnly: true },
];

interface AdminScreenProps {
  onClose: () => void;
}

const AdminScreen: React.FC<AdminScreenProps> = ({ onClose: _ }) => {
  const wallet = useWallet();
  const walletAddress = wallet.publicKey?.toString();
  const isDev = isDevWallet(walletAddress);

  const [activeTab, setActiveTab] = useState<AdminTab>("config");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [apiKey, setApiKey] = useState(
    () => localStorage.getItem("admin_api_key") ?? ""
  );

  const configDoc = useQuery(api.admin.getGameConfig);
  const [draft, setDraft] = useState<ConfigFields | null>(null);

  const currentConfig: ConfigFields | null =
    draft ?? (configDoc ? normalizeGameConfig(configDoc) : null);

  const visibleTabs = TABS.filter((t) => !t.devOnly || import.meta.env.DEV);
  const visibleTabIds = visibleTabs.map((t) => t.id);
  const setActiveTabCb = useCallback((tab: AdminTab) => setActiveTab(tab), []);
  useArrowTabNav(visibleTabIds, activeTab, setActiveTabCb);

  const setField = <K extends keyof ConfigFields>(
    key: K,
    value: ConfigFields[K]
  ) => {
    setDraft((prev) => ({
      ...(prev ?? currentConfig ?? ({} as ConfigFields)),
      [key]: value,
    }));
  };

  const setArrayItem = (
    key: "tierBreakpointsUsd" | "pillsPerTier" | "astrdsPerPill",
    idx: number,
    value: number
  ) => {
    setDraft((prev) => {
      const base = prev ?? currentConfig ?? ({} as ConfigFields);
      const arr = [...(base[key] as number[])];
      arr[idx] = value;
      return { ...base, [key]: arr };
    });
  };

  const handleSave = async () => {
    if (!currentConfig || !apiKey) return;
    setSaving(true);
    setStatus("");
    try {
      const siteUrl =
        import.meta.env.VITE_CONVEX_URL?.replace(
          ".convex.cloud",
          ".convex.site"
        ) ?? "";
      const resp = await fetch(`${siteUrl}/admin/config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(currentConfig),
      });
      if (!resp.ok) throw new Error(`${resp.status} ${await resp.text()}`);
      setStatus("Saved");
      setDraft(null);
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : "Unknown"}`);
    } finally {
      setSaving(false);
    }
  };

  if (!isDev) {
    return (
      <div className="p-10 flex flex-col items-center justify-center gap-2 min-h-[240px]">
        <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
          Admin
        </div>
        <div className="font-mono text-xs text-tx-dim">
          {walletAddress
            ? "Wallet not authorized"
            : "Connect an authorized wallet"}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tab bar */}
      <div className="flex items-stretch border-b border-border shrink-0">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? "border-edge-subtle0 text-foreground"
                : "border-transparent text-muted-foreground hover:text-tx-secondary"
            }`}
          >
            {tab.label}
          </button>
        ))}
        <div className="ml-auto flex items-center px-4 font-mono text-[9px] text-tx-dim">
          v{configDoc?.version ?? "—"}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {activeTab === "config" && currentConfig && (
          <div className="p-6 space-y-5 font-mono text-xs">
            <div className="border border-primary/30 bg-primary/5 px-3 py-2 text-[10px] text-muted-foreground">
              <span className="text-primary">LIVE:</span> fields on this tab are
              persisted in Convex and consumed by the game server. Level Bands
              are also persisted and enforced before they are shown as
              authoritative.
            </div>

            {/* Apply to running */}
            <div className="flex items-center justify-between border border-border px-3 py-2.5">
              <div>
                <div className="text-foreground text-[11px]">
                  Apply to running sessions
                </div>
                <div className="text-muted-foreground text-[9px] mt-0.5">
                  Changes take effect mid-game when on
                </div>
              </div>
              <button
                onClick={() =>
                  setField("applyToRunning", !currentConfig.applyToRunning)
                }
                className={`text-[10px] px-3 py-0.5 border transition-colors ${
                  currentConfig.applyToRunning
                    ? "bg-primary/30 border-primary/50 text-primary"
                    : "bg-surface-subtle border-edge-medium text-muted-foreground"
                }`}
              >
                {currentConfig.applyToRunning ? "ON" : "OFF"}
              </button>
            </div>

            {/* Economy */}
            <div>
              <div className="text-muted-foreground text-[9px] uppercase tracking-widest mb-2">
                Economy
              </div>
              <div className="space-y-1.5">
                <NumericRow
                  label="Quarter price (USD)"
                  value={currentConfig.quarterUsd}
                  min={0.01}
                  max={5}
                  step={0.05}
                  display={(v) => `$${v.toFixed(2)}`}
                  onChange={(v) => setField("quarterUsd", v)}
                />
              </div>
            </div>

            {/* Emission Tiers */}
            <div>
              <div className="text-muted-foreground text-[9px] uppercase tracking-widest mb-2">
                Emission Tiers
              </div>
              <div className="border border-border">
                {/* Header */}
                <div className="grid grid-cols-[2rem_1fr_5rem_5rem_5rem] gap-0 px-2 py-1 border-b border-border">
                  <span className="font-mono text-[9px] text-tx-dim">#</span>
                  <span className="font-mono text-[9px] text-tx-dim">
                    Price range
                  </span>
                  <span className="font-mono text-[9px] text-tx-dim text-right">
                    Min $
                  </span>
                  <span className="font-mono text-[9px] text-tx-dim text-right">
                    Pills
                  </span>
                  <span className="font-mono text-[9px] text-tx-dim text-right">
                    ASTRDS/pill
                  </span>
                </div>
                {[0, 1, 2, 3, 4].map((i) => {
                  const bp = currentConfig.tierBreakpointsUsd;
                  const minUsd = i === 0 ? 0 : bp[i - 1];
                  const maxUsd = i < 4 ? bp[i] : null;
                  const isLast = i === 4;
                  return (
                    <div
                      key={i}
                      className="grid grid-cols-[2rem_1fr_5rem_5rem_5rem] gap-0 px-2 py-2 border-b border-edge-subtle last:border-0 items-center"
                    >
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {i + 1}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {i === 0 ? "$0" : `$${minUsd.toFixed(4)}`} –{" "}
                        {isLast ? "∞" : `$${maxUsd!.toFixed(4)}`}
                      </span>
                      {/* Breakpoint editor (min price of next tier) */}
                      {!isLast ? (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() =>
                              setArrayItem(
                                "tierBreakpointsUsd",
                                i,
                                Math.max(
                                  0.0001,
                                  parseFloat((bp[i] - 0.001).toFixed(6))
                                )
                              )
                            }
                            className="w-4 h-4 flex items-center justify-center border border-edge-subtle text-muted-foreground hover:text-foreground text-[10px]"
                          >
                            −
                          </button>
                          <span className="font-mono text-[10px] text-foreground w-12 text-right">
                            ${bp[i].toFixed(4)}
                          </span>
                          <button
                            onClick={() =>
                              setArrayItem(
                                "tierBreakpointsUsd",
                                i,
                                parseFloat((bp[i] + 0.001).toFixed(6))
                              )
                            }
                            className="w-4 h-4 flex items-center justify-center border border-edge-subtle text-muted-foreground hover:text-foreground text-[10px]"
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <span className="font-mono text-[9px] text-tx-dim text-right pr-1">
                          —
                        </span>
                      )}
                      {/* Pills */}
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() =>
                            setArrayItem(
                              "pillsPerTier",
                              i,
                              Math.max(1, currentConfig.pillsPerTier[i] - 1)
                            )
                          }
                          className="w-4 h-4 flex items-center justify-center border border-edge-subtle text-muted-foreground hover:text-foreground text-[10px]"
                        >
                          −
                        </button>
                        <span className="font-mono text-[10px] text-foreground w-6 text-center">
                          {currentConfig.pillsPerTier[i]}
                        </span>
                        <button
                          onClick={() =>
                            setArrayItem(
                              "pillsPerTier",
                              i,
                              currentConfig.pillsPerTier[i] + 1
                            )
                          }
                          className="w-4 h-4 flex items-center justify-center border border-edge-subtle text-muted-foreground hover:text-foreground text-[10px]"
                        >
                          +
                        </button>
                      </div>
                      {/* ASTRDS/pill */}
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() =>
                            setArrayItem(
                              "astrdsPerPill",
                              i,
                              Math.max(
                                0.1,
                                parseFloat(
                                  (
                                    currentConfig.astrdsPerPill[i] - 0.5
                                  ).toFixed(2)
                                )
                              )
                            )
                          }
                          className="w-4 h-4 flex items-center justify-center border border-edge-subtle text-muted-foreground hover:text-foreground text-[10px]"
                        >
                          −
                        </button>
                        <span className="font-mono text-[10px] text-foreground w-8 text-center">
                          {currentConfig.astrdsPerPill[i]}
                        </span>
                        <button
                          onClick={() =>
                            setArrayItem(
                              "astrdsPerPill",
                              i,
                              parseFloat(
                                (currentConfig.astrdsPerPill[i] + 0.5).toFixed(
                                  2
                                )
                              )
                            )
                          }
                          className="w-4 h-4 flex items-center justify-center border border-edge-subtle text-muted-foreground hover:text-foreground text-[10px]"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="font-mono text-[9px] text-tx-dim mt-1">
                Total ASTRDS per game:{" "}
                {[0, 1, 2, 3, 4]
                  .map(
                    (i) =>
                      `T${i + 1}: ${(
                        currentConfig.pillsPerTier[i] *
                        currentConfig.astrdsPerPill[i]
                      ).toFixed(1)}`
                  )
                  .join(" · ")}
              </div>
            </div>

            {/* Powerups */}
            <div>
              <div className="text-muted-foreground text-[9px] uppercase tracking-widest mb-2">
                Powerups
              </div>
              <div className="space-y-1.5">
                <NumericRow
                  label="Max on screen"
                  value={currentConfig.maxPowerupsOnScreen}
                  min={0}
                  max={5}
                  step={1}
                  onChange={(v) => setField("maxPowerupsOnScreen", v)}
                />
                <NumericRow
                  label="Duration"
                  value={currentConfig.powerupDurationMs}
                  min={1000}
                  max={60000}
                  step={1000}
                  display={(v) => `${v / 1000}s`}
                  onChange={(v) => setField("powerupDurationMs", v)}
                />
                <NumericRow
                  label="Spawn interval"
                  value={currentConfig.powerupSpawnDelayMs}
                  min={1000}
                  max={60000}
                  step={1000}
                  display={(v) => `${v / 1000}s`}
                  onChange={(v) => setField("powerupSpawnDelayMs", v)}
                />
              </div>
            </div>

            {/* Ship */}
            <div>
              <div className="text-muted-foreground text-[9px] uppercase tracking-widest mb-2">
                Ship tuning
              </div>
              <div className="space-y-1.5">
                <NumericRow
                  label="Ship radius"
                  value={currentConfig.shipRadius}
                  min={8}
                  max={40}
                  step={1}
                  onChange={(v) => setField("shipRadius", v)}
                />
                <NumericRow
                  label="Rotation speed"
                  value={currentConfig.shipRotationSpeed}
                  min={1}
                  max={15}
                  step={0.5}
                  onChange={(v) => setField("shipRotationSpeed", v)}
                />
                <NumericRow
                  label="Acceleration"
                  value={currentConfig.shipAcceleration}
                  min={0.05}
                  max={1}
                  step={0.05}
                  onChange={(v) => setField("shipAcceleration", v)}
                />
                <NumericRow
                  label="Inertia"
                  value={currentConfig.shipInertia}
                  min={0.9}
                  max={1}
                  step={0.005}
                  onChange={(v) => setField("shipInertia", v)}
                />
                <NumericRow
                  label="Respawn invulnerability"
                  value={currentConfig.shipInvulnerabilityMs}
                  min={0}
                  max={10000}
                  step={500}
                  display={(v) => `${v / 1000}s`}
                  onChange={(v) => setField("shipInvulnerabilityMs", v)}
                />
                <NumericRow
                  label="Starting lives"
                  value={currentConfig.startingLives}
                  min={1}
                  max={10}
                  step={1}
                  onChange={(v) => setField("startingLives", v)}
                />
                <NumericRow
                  label="Max lives (cap)"
                  value={currentConfig.maxLives}
                  min={1}
                  max={10}
                  step={1}
                  onChange={(v) => setField("maxLives", v)}
                />
              </div>
            </div>

            {/* Bullets */}
            <div>
              <div className="text-muted-foreground text-[9px] uppercase tracking-widest mb-2">
                Bullet tuning
              </div>
              <div className="space-y-1.5">
                <NumericRow
                  label="Normal speed"
                  value={currentConfig.normalBulletSpeed}
                  min={5}
                  max={40}
                  step={1}
                  onChange={(v) => setField("normalBulletSpeed", v)}
                />
                <NumericRow
                  label="Rapid speed"
                  value={currentConfig.rapidBulletSpeed}
                  min={5}
                  max={50}
                  step={1}
                  onChange={(v) => setField("rapidBulletSpeed", v)}
                />
                <NumericRow
                  label="Normal fire delay"
                  value={currentConfig.normalFireDelayMs}
                  min={25}
                  max={1000}
                  step={25}
                  display={(v) => `${v}ms`}
                  onChange={(v) => setField("normalFireDelayMs", v)}
                />
                <NumericRow
                  label="Rapid fire delay"
                  value={currentConfig.rapidFireDelayMs}
                  min={10}
                  max={500}
                  step={10}
                  display={(v) => `${v}ms`}
                  onChange={(v) => setField("rapidFireDelayMs", v)}
                />
                <NumericRow
                  label="Bullet radius"
                  value={currentConfig.bulletRadius}
                  min={0.5}
                  max={8}
                  step={0.5}
                  onChange={(v) => setField("bulletRadius", v)}
                />
                <NumericRow
                  label="Rapid bullet radius"
                  value={currentConfig.rapidBulletRadius}
                  min={0.5}
                  max={8}
                  step={0.5}
                  onChange={(v) => setField("rapidBulletRadius", v)}
                />
                <NumericRow
                  label="Rapid bullet power"
                  value={currentConfig.rapidBulletPower}
                  min={1}
                  max={5}
                  step={1}
                  onChange={(v) => setField("rapidBulletPower", v)}
                />
                <NumericRow
                  label="Collision padding"
                  value={currentConfig.bulletCollisionPadding}
                  min={0}
                  max={20}
                  step={1}
                  onChange={(v) => setField("bulletCollisionPadding", v)}
                />
              </div>
            </div>

            {/* Asteroids */}
            <div>
              <div className="text-muted-foreground text-[9px] uppercase tracking-widest mb-2">
                Asteroids
              </div>
              <div className="space-y-1.5">
                <NumericRow
                  label="Large radius"
                  value={currentConfig.largeAsteroidRadius}
                  min={20}
                  max={80}
                  step={2}
                  onChange={(v) => setField("largeAsteroidRadius", v)}
                />
                <NumericRow
                  label="Medium radius"
                  value={currentConfig.mediumAsteroidRadius}
                  min={10}
                  max={50}
                  step={2}
                  onChange={(v) => setField("mediumAsteroidRadius", v)}
                />
                <NumericRow
                  label="Small radius"
                  value={currentConfig.smallAsteroidRadius}
                  min={5}
                  max={30}
                  step={1}
                  onChange={(v) => setField("smallAsteroidRadius", v)}
                />
                <NumericRow
                  label="Velocity min"
                  value={currentConfig.asteroidVelocityMin}
                  min={-5}
                  max={0}
                  step={0.1}
                  onChange={(v) => setField("asteroidVelocityMin", v)}
                />
                <NumericRow
                  label="Velocity max"
                  value={currentConfig.asteroidVelocityMax}
                  min={0}
                  max={5}
                  step={0.1}
                  onChange={(v) => setField("asteroidVelocityMax", v)}
                />
                <NumericRow
                  label="Score large"
                  value={currentConfig.asteroidScoreLarge}
                  min={0}
                  max={1000}
                  step={5}
                  onChange={(v) => setField("asteroidScoreLarge", v)}
                />
                <NumericRow
                  label="Score medium"
                  value={currentConfig.asteroidScoreMedium}
                  min={0}
                  max={1000}
                  step={5}
                  onChange={(v) => setField("asteroidScoreMedium", v)}
                />
                <NumericRow
                  label="Score small"
                  value={currentConfig.asteroidScoreSmall}
                  min={0}
                  max={1000}
                  step={5}
                  onChange={(v) => setField("asteroidScoreSmall", v)}
                />
              </div>
            </div>

            {/* Pickups */}
            <div>
              <div className="text-muted-foreground text-[9px] uppercase tracking-widest mb-2">
                Pickup tuning
              </div>
              <div className="space-y-1.5">
                <NumericRow
                  label="ASTRDS pill interval"
                  value={currentConfig.pillSpawnDelayMs}
                  min={500}
                  max={60000}
                  step={500}
                  display={(v) => `${v / 1000}s`}
                  onChange={(v) => setField("pillSpawnDelayMs", v)}
                />
                <NumericRow
                  label="Space-token opportunity interval"
                  value={currentConfig.tokenSpawnDelayMs}
                  min={1000}
                  max={120000}
                  step={1000}
                  display={(v) => `${v / 1000}s`}
                  onChange={(v) => setField("tokenSpawnDelayMs", v)}
                />
                <NumericRow
                  label="Space-token spawn chance"
                  value={currentConfig.spaceTokenSpawnChance}
                  min={0}
                  max={1}
                  step={0.05}
                  display={(v) => `${Math.round(v * 100)}%`}
                  onChange={(v) => setField("spaceTokenSpawnChance", v)}
                />
                <NumericRow
                  label="Pickup TTL"
                  value={currentConfig.pickupTtlMs}
                  min={1000}
                  max={120000}
                  step={1000}
                  display={(v) => `${v / 1000}s`}
                  onChange={(v) => setField("pickupTtlMs", v)}
                />
                <NumericRow
                  label="Pickup radius"
                  value={currentConfig.pickupRadius}
                  min={2}
                  max={30}
                  step={1}
                  onChange={(v) => setField("pickupRadius", v)}
                />
                <NumericRow
                  label="Ship pickup radius"
                  value={currentConfig.shipPickupRadius}
                  min={5}
                  max={50}
                  step={1}
                  onChange={(v) => setField("shipPickupRadius", v)}
                />
                <NumericRow
                  label="Ship pickup interval"
                  value={currentConfig.shipPickupSpawnDelayMs}
                  min={5000}
                  max={120000}
                  step={5000}
                  display={(v) => `${v / 1000}s`}
                  onChange={(v) => setField("shipPickupSpawnDelayMs", v)}
                />
                <NumericRow
                  label="Max ship pickups on screen"
                  value={currentConfig.maxShipPickupsOnScreen}
                  min={0}
                  max={5}
                  step={1}
                  onChange={(v) => setField("maxShipPickupsOnScreen", v)}
                />
              </div>
            </div>

            {/* Save */}
            <div className="flex flex-col gap-2 pt-1 border-t border-border">
              <div className="flex items-center gap-2">
                <span className="text-[9px] uppercase tracking-widest text-muted-foreground w-16 shrink-0">
                  API Key
                </span>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    localStorage.setItem("admin_api_key", e.target.value);
                  }}
                  placeholder="ADMIN_API_KEY"
                  className="flex-1 bg-transparent border border-border text-[10px] font-mono px-2 py-1 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSave}
                  disabled={saving || !apiKey}
                  className="bg-primary/20 border border-primary/40 text-primary px-6 py-2 hover:bg-primary/30 transition-colors disabled:opacity-40 text-[10px] uppercase tracking-widest"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                {status && (
                  <span
                    className={`text-[10px] font-mono ${
                      status.startsWith("Error")
                        ? "text-destructive"
                        : "text-tx-success"
                    }`}
                  >
                    {status}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "bands" && (
          <div className="p-6">
            {currentConfig && (
              <LevelBandEditor
                bands={currentConfig.progressionBands}
                onChange={(bands) => setField("progressionBands", bands)}
                pillsPerTier={currentConfig.pillsPerTier}
                astrdsPerPill={currentConfig.astrdsPerPill}
                onSave={handleSave}
                saving={saving}
                apiKey={apiKey}
                onApiKeyChange={(value) => {
                  setApiKey(value);
                  localStorage.setItem("admin_api_key", value);
                }}
                status={status}
              />
            )}
          </div>
        )}

        {activeTab === "sound" && <SoundManager />}

        {activeTab === "dev" && <DevTools />}
      </div>
    </div>
  );
};

interface NumericRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display?: (v: number) => string;
  onChange: (v: number) => void;
}

const NumericRow: React.FC<NumericRowProps> = ({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}) => {
  const fmt = display ?? ((v: number) => String(v));
  return (
    <div className="flex items-center gap-3 border border-border px-3 py-1.5">
      <span className="flex-1 text-tx-secondary text-[10px]">{label}</span>
      <button
        onClick={() =>
          onChange(Math.max(min, parseFloat((value - step).toFixed(10))))
        }
        className="w-6 h-6 flex items-center justify-center border border-edge-subtle text-muted-foreground hover:text-foreground transition-colors"
      >
        −
      </button>
      <span className="w-16 text-center text-foreground text-[11px]">
        {fmt(value)}
      </span>
      <button
        onClick={() =>
          onChange(Math.min(max, parseFloat((value + step).toFixed(10))))
        }
        className="w-6 h-6 flex items-center justify-center border border-edge-subtle text-muted-foreground hover:text-foreground transition-colors"
      >
        +
      </button>
    </div>
  );
};

export default AdminScreen;
