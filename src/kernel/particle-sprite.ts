/**
 * 粒子精灵 ParticleSprite（形状/模式/生命期）（原 starfall.core.js 第 25588-25659 行）
 * ---------------------------------------------------------------
 * 工具自动抽取，变量名/逻辑与线上 100% 一致，仅做物理拆分。
 * 已验证：段内不引用任何块外顶层符号（无循环依赖）。
 * 变更内核时请同步更新 kernel/SECTIONS.md。
 */
class ParticleSprite {
  alive = !1
  shape = 0
  mode = 0
  t0 = 0
  life = 1
  manual = !1
  x = 0
  y = 0
  z = 0
  vx = 0
  vy = 0
  vz = 0
  gravity = 0
  sx0 = 1
  sy0 = 1
  sz0 = 1
  sx1 = 1
  sy1 = 1
  sz1 = 1
  ease = 1
  rx = 0
  ry = 0
  rz = 0
  wx = 0
  wy = 0
  wz = 0
  r = 1
  g = 1
  b = 1
  a = 1
  fadeIn = 0.08
  fadeOut = 0.4
  add = 1
  k = 2
  progress = -1
  seed = 0
  followId = -1
  at(positionX, positionY, positionZ) {
    return ((this.x = positionX), (this.y = positionY), (this.z = positionZ), this)
  }
  vel(velocityX, velocityY, velocityZ, gravity = 0) {
    return ((this.vx = velocityX), (this.vy = velocityY), (this.vz = velocityZ), (this.gravity = gravity), this)
  }
  scale(startScale, endScale = startScale) {
    return ((this.sx0 = this.sy0 = this.sz0 = startScale), (this.sx1 = this.sy1 = this.sz1 = endScale), this)
  }
  scale3(startScaleX, startScaleY, startScaleZ, endScaleX = startScaleX, endScaleY = startScaleY, endScaleZ = startScaleZ) {
    return ((this.sx0 = startScaleX), (this.sy0 = startScaleY), (this.sz0 = startScaleZ), (this.sx1 = endScaleX), (this.sy1 = endScaleY), (this.sz1 = endScaleZ), this)
  }
  rot(rotationX, rotationY, rotationZ) {
    return ((this.rx = rotationX), (this.ry = rotationY), (this.rz = rotationZ), this)
  }
  spin(spinX, spinY, spinZ) {
    return ((this.wx = spinX), (this.wy = spinY), (this.wz = spinZ), this)
  }
  color(black, intensity = 1, opacity = 1) {
    return ((this.r = black.r * intensity), (this.g = black.g * intensity), (this.b = black.b * intensity), (this.a = opacity), this)
  }
  fade(fadeInDuration, fadeOutDuration) {
    return ((this.fadeIn = fadeInDuration), (this.fadeOut = fadeOutDuration), this)
  }
  opt(additiveStrength, glowCoefficient, easeMode = this.ease) {
    return ((this.add = additiveStrength), (this.k = glowCoefficient), (this.ease = easeMode), this)
  }
  follow(followId) {
    return ((this.followId = followId), this)
  }
  delay(delayTime) {
    return ((this.t0 += delayTime), this)
  }
}

export { ParticleSprite }
