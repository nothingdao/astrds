// src/game/entities/Ship.ts
import { rotatePoint } from "@/utils/helpers";
import { usePowerupStore } from "../../stores/powerupStore";
import { useEngineStore } from "../../stores/engineStore";
import { useInventoryStore } from "../../stores/inventoryStore";
import { particleSystem } from "../systems/ParticleSystem";
import { audioService } from "../../services/audio/AudioService";
import { bulletSystem } from "../systems/BulletSystem";
import { ShipConfig, ShipState, ShipMethods } from "@/types/entities/ship";
import { ScreenBounds, Vector2D } from "@/types/core";
import { PowerupStore } from "@/types/stores/powerup";
import { getCanvasTokens } from "@/lib/designTokens";

export default class Ship implements ShipState, ShipMethods {
  public id: string;
  public position: Vector2D;
  public velocity: Vector2D;
  public rotation: number;
  public rotationSpeed: number;
  public speed: number;
  public inertia: number;
  public radius: number;
  public lastShot: number;
  public delete: boolean;
  public isInvulnerable: boolean;
  public invulnerabilityTime: number;
  public onDie?: () => void;
  private isThrustActive: boolean;

  constructor(args: ShipConfig) {
    this.id = `ship-${Date.now()}`;
    this.position = args.position;
    this.velocity = {
      x: 0,
      y: 0,
    };
    this.rotation = 0;
    this.rotationSpeed = 6;
    this.speed = 0.25;
    this.inertia = 0.99;
    this.radius = 20;
    this.lastShot = 0;
    this.onDie = args.onDie;
    this.delete = false;
    this.isInvulnerable = args.isRespawning || false;
    this.invulnerabilityTime = args.isRespawning ? Date.now() : 0;
    this.isThrustActive = false;
  }

  destroy(): void {
    const powerups = usePowerupStore.getState() as PowerupStore;
    if (powerups.powerups.invincible || this.isInvulnerable) return;

    this.delete = true;
    audioService.stopSoundLoop("thrust");
    this.isThrustActive = false;
    audioService.playSound("explosion");

    particleSystem.createExplosion(this.position, this.radius, 60);

    const inventory = useInventoryStore.getState();
    console.log("Ships remaining:", inventory.items.ships);

    if (inventory.items.ships > 0) {
      console.log("Using a ship from inventory");

      useInventoryStore.setState((state) => ({
        items: {
          ...state.items,
          ships: state.items.ships - 1,
        },
      }));

      setTimeout(() => {
        const engineStore = useEngineStore.getState();
        const screen = engineStore.screen;
        const newShip = new Ship({
          position: {
            x: screen.width / 2,
            y: screen.height / 2,
          },
          isRespawning: true,
          onDie: this.onDie,
        });
        console.log("Spawning new ship with invulnerability");
        engineStore.addEntity(newShip, "ship");
      }, 2000);
    } else {
      console.log("No ships left - game over");
      this.onDie?.();
    }
  }

  public rotate(dir: "LEFT" | "RIGHT"): void {
    if (dir === "LEFT") {
      this.rotation -= this.rotationSpeed;
    }
    if (dir === "RIGHT") {
      this.rotation += this.rotationSpeed;
    }
  }

  public accelerate(): void {
    this.velocity.x -= Math.sin((-this.rotation * Math.PI) / 180) * this.speed;
    this.velocity.y -= Math.cos((-this.rotation * Math.PI) / 180) * this.speed;

    if (!this.isThrustActive) {
      this.isThrustActive = true;
      audioService.playSoundLoop("thrust");
    }

    if (Math.random() > 0.5) {
      let posDelta = rotatePoint(
        { x: 0, y: -10 },
        { x: 0, y: 0 },
        ((this.rotation - 180) * Math.PI) / 180
      );
      particleSystem.createThrusterParticle(this.position, posDelta);
    }
  }

  public stopThrust(): void {
    if (this.isThrustActive) {
      this.isThrustActive = false;
      audioService.stopSoundLoop("thrust");
    }
  }

  shootBullet(): void {
    const now = Date.now();
    const powerups = usePowerupStore.getState() as PowerupStore;

    const fireRate = powerups.powerups.rapidFire ? 50 : 250;
    const bulletType = powerups.powerups.rapidFire
      ? "rapid"
      : powerups.powerups.beam
      ? "beam"
      : powerups.powerups.spread
      ? "spread"
      : "normal";

    if (now - this.lastShot > fireRate) {
      bulletSystem.fireBullet(this, bulletType);
      this.lastShot = now;
    }
  }

  update(_dt: number, screen: ScreenBounds): void {
    if (this.isInvulnerable && Date.now() - this.invulnerabilityTime > 3000) {
      this.isInvulnerable = false;
    }

    this.position.x += this.velocity.x;
    this.position.y += this.velocity.y;
    this.velocity.x *= this.inertia;
    this.velocity.y *= this.inertia;

    const { width, height } = screen;

    if (this.rotation >= 360) {
      this.rotation -= 360;
    }
    if (this.rotation < 0) {
      this.rotation += 360;
    }

    if (this.position.x > width) this.position.x = 0;
    else if (this.position.x < 0) this.position.x = width;
    if (this.position.y > height) this.position.y = 0;
    else if (this.position.y < 0) this.position.y = height;
  }

  render(context: CanvasRenderingContext2D): void {
    const colors = getCanvasTokens();

    context.save();
    context.translate(this.position.x, this.position.y);

    if (
      this.isInvulnerable ||
      (usePowerupStore.getState() as PowerupStore).powerups.invincible
    ) {
      context.shadowColor = colors.shipGlow;
      context.shadowBlur = 10;
      const pulseScale = 1 + Math.sin(Date.now() / 200) * 0.1;
      context.scale(pulseScale, pulseScale);
    }

    context.rotate((this.rotation * Math.PI) / 180);
    context.strokeStyle = colors.shipStroke;
    context.fillStyle = colors.shipFill;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(0, -15);
    context.lineTo(10, 10);
    context.lineTo(5, 7);
    context.lineTo(-5, 7);
    context.lineTo(-10, 10);
    context.closePath();
    context.fill();
    context.stroke();
    context.restore();
  }
}
