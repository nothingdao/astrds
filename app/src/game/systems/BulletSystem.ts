// src/game/systems/BulletSystem.ts
import { useEngineStore } from '@/stores/engineStore'
import Bullet from '../entities/Bullet'

export class BulletSystem {
  constructor(maxBullets = 15) {
    this.maxBullets = maxBullets
    this.pool = Array(maxBullets)
      .fill(null)
      .map(() => ({
        bullet: null,
        active: false,
        createTime: 0,
      }))
    this.lastShot = 0
  }

  releaseBullet(bullet) {
    const slot = this.pool.find((item) => item.bullet === bullet)
    if (slot) {
      slot.bullet = null // Remove bullet reference
      slot.active = false // Mark slot as inactive
      slot.createTime = 0 // Reset creation time
    }
  }

  createBullet(args) {
    // Force cleanup old bullets first
    const now = Date.now()
    this.pool.forEach((slot) => {
      if (slot.active && now - slot.createTime > 1000) {
        slot.bullet?.destroy()
        slot.active = false
      }
    })

    const activeCount = this.pool.filter((item) => item.active).length

    if (activeCount >= this.maxBullets) {
      const oldestSlot = this.pool
        .filter((item) => item.active)
        .sort((a, b) => a.createTime - b.createTime)[0]

      if (oldestSlot) {
        oldestSlot.bullet?.destroy()
        oldestSlot.active = false
      }
    }

    const slot = this.pool.find((item) => !item.active)
    if (!slot) return null

    if (!slot.bullet) {
      slot.bullet = new Bullet(args)
    } else {
      slot.bullet.init(args)
    }

    slot.active = true
    slot.createTime = now
    useEngineStore.getState().addEntity(slot.bullet, 'bullets')
    return slot.bullet
  }

  fireBullet(ship, powerUpType = 'normal') {
    const patterns = {
      normal: () => {
        this.createBullet({
          ship,
          radius: 2,
          power: 1,
          speed: 15,
          lifeSpan: 35,
        })
      },
      spread: () => {
        ;[-15, 15].forEach((angle) => {
          const adjustedRotation = ship.rotation + angle
          this.createBullet({
            ship,
            rotation: adjustedRotation,
            radius: 2,
            power: 1.2,
            speed: 12,
            lifeSpan: 30,
          })
        })
      },
      beam: () => {
        this.createBullet({
          ship,
          radius: 5,
          power: 4,
          speed: 18,
          color: '#4dc1f9',
          piercing: true,
          lifeSpan: 25,
        })
      },
      rapid: () => {
        this.createBullet({
          ship,
          radius: 1.5,
          power: 0.7,
          speed: 20,
          lifeSpan: 25,
        })
      },
    }

    const now = Date.now()
    const cooldowns = {
      normal: 300,
      spread: 500,
      beam: 600,
      rapid: 150,
    }

    if (now - this.lastShot < (cooldowns[powerUpType] || cooldowns.normal)) {
      return
    }

    this.lastShot = now
    patterns[powerUpType]?.() || patterns.normal()
  }
}

export const bulletSystem = new BulletSystem(50)
