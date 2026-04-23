import type { AsteroidSnapshot, GameSnapshot, PickupSnapshot, ShipSnapshot } from '@shared/game/protocol'

function drawShip(ctx: CanvasRenderingContext2D, ship: ShipSnapshot): void {
  ctx.save()
  ctx.translate(ship.position.x, ship.position.y)

  if (ship.isInvulnerable) {
    ctx.shadowColor = '#4dc1f9'
    ctx.shadowBlur = 10
    const pulseScale = 1 + Math.sin(Date.now() / 200) * 0.1
    ctx.scale(pulseScale, pulseScale)
  }

  ctx.rotate((ship.rotation * Math.PI) / 180)
  ctx.strokeStyle = '#ffffff'
  ctx.fillStyle = '#000000'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, -15)
  ctx.lineTo(10, 10)
  ctx.lineTo(5, 7)
  ctx.lineTo(-5, 7)
  ctx.lineTo(-10, 10)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

function drawAsteroid(ctx: CanvasRenderingContext2D, asteroid: AsteroidSnapshot): void {
  ctx.save()
  ctx.translate(asteroid.position.x, asteroid.position.y)
  ctx.rotate((asteroid.rotation * Math.PI) / 180)
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 0.4
  ctx.beginPath()
  ctx.moveTo(0, -asteroid.radius)
  for (let i = 1; i < asteroid.vertices.length; i += 1) {
    ctx.lineTo(asteroid.vertices[i].x, asteroid.vertices[i].y)
  }
  ctx.closePath()
  ctx.stroke()
  ctx.restore()
}

function drawPickup(ctx: CanvasRenderingContext2D, pickup: PickupSnapshot): void {
  ctx.save()
  ctx.translate(pickup.position.x, pickup.position.y)

  if (pickup.kind === 'shipPickup') {
    ctx.beginPath()
    ctx.arc(0, 0, pickup.radius - 5, 0, Math.PI * 2)
    ctx.fillStyle = pickup.color
    ctx.fill()
    ctx.strokeStyle = '#FFFFFF'
    ctx.lineWidth = 1
    ctx.shadowBlur = 10
    ctx.shadowColor = '#FFFFFF'
    ctx.stroke()
    ctx.shadowBlur = 0
    ctx.strokeStyle = '#1E90FF'
    ctx.beginPath()
    ctx.moveTo(0, -19.5)
    ctx.lineTo(13, 13)
    ctx.lineTo(6.5, 9.1)
    ctx.lineTo(-6.5, 9.1)
    ctx.lineTo(-13, 13)
    ctx.closePath()
    ctx.stroke()
    ctx.restore()
    return
  }

  ctx.strokeStyle = pickup.color
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(0, 0, pickup.radius, 0, 2 * Math.PI)
  ctx.stroke()
  ctx.restore()
}

export function renderServerSnapshot(
  ctx: CanvasRenderingContext2D,
  snapshot: GameSnapshot,
  ratio: number
): void {
  ctx.save()
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  ctx.fillStyle = '#000'
  ctx.globalAlpha = 0.4
  ctx.fillRect(0, 0, snapshot.screen.width, snapshot.screen.height)
  ctx.globalAlpha = 1

  if (snapshot.ship) {
    drawShip(ctx, snapshot.ship)
  }

  snapshot.asteroids.forEach((asteroid) => drawAsteroid(ctx, asteroid))

  snapshot.bullets.forEach((bullet) => {
    ctx.save()
    ctx.translate(bullet.position.x, bullet.position.y)
    ctx.rotate((bullet.rotation * Math.PI) / 180)
    ctx.fillStyle = bullet.color
    ctx.beginPath()
    ctx.arc(0, 0, bullet.radius, 0, 2 * Math.PI)
    ctx.closePath()
    ctx.fill()
    if (bullet.power > 1) {
      ctx.shadowColor = bullet.color
      ctx.shadowBlur = bullet.power * 2
      ctx.fill()
    }
    ctx.restore()
  })

  snapshot.pills.forEach((pickup) => drawPickup(ctx, pickup))
  snapshot.tokens.forEach((pickup) => drawPickup(ctx, pickup))
  snapshot.shipPickups.forEach((pickup) => drawPickup(ctx, pickup))

  ctx.restore()
}
