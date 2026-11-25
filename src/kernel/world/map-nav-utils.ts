/**
 * 地图导航工具
 *
 * 由 tools/extract-symbols.cjs 自动抽取：声明文本与顺序逐字节保留，仅做物理搬迁。
 */

import { CustomBlending, DoubleSide, InstancedBufferAttribute, InstancedMesh, Matrix4, OneFactor, OneMinusSrcAlphaFactor, PlaneGeometry, ShaderMaterial, Vector3 } from 'three'
import { FastRandom } from '../render/foundation'
import { colorToRgb } from '../fx/particle-system'
import { polygonCentroid } from '../render/buff-view'
import { WATER_LEVEL } from './map-geometry'
import { ARENA_SHARED_UNIFORMS } from '../arena-palette'
import { UNIT_ATTRIBUTE_DECLS, UNIT_ATTRIBUTE_FRAGMENT_SHADER, UNIT_ATTRIBUTE_VERTEX_SHADER } from '../render/unit-attribute-shaders'
import { SUN_DIRECTION } from '../render/scene-rigs'

function buildAtmosphereLayer(bushMap, cliffFeatures, initialSprites, noiseTexture, qualitySettings) {
  const gameMap = bushMap.map,
    atmosphereRandom = new FastRandom(60606),
    atmosphereSprites = [...initialSprites],
    beamColor = colorToRgb(16771519),
    fogColor = colorToRgb(13954293)
  for (const item of cliffFeatures) {
    if (item.kind === "ridge" || item.inradius < 3) continue
    const polygonCentroidResult = polygonCentroid(item.poly)
    if (bushMap.laneDist(polygonCentroidResult.x, polygonCentroidResult.y) < 2 || bushMap.baseDist(polygonCentroidResult.x, polygonCentroidResult.y, 12) < 4) continue
    const beamCount = item.inradius > 4.5 ? 2 : 1
    for (let index = 0; index < beamCount; index++)
      atmosphereSprites.push({ kind: "beam", x: polygonCentroidResult.x + atmosphereRandom.range(-2.2, 2.2), y: item.height + 0.3, z: polygonCentroidResult.y + atmosphereRandom.range(-2.2, 2.2), width: atmosphereRandom.range(2.6, 4), length: atmosphereRandom.range(9, 12), color: beamColor, alpha: atmosphereRandom.range(0.05, 0.085) })
  }
  const riverPoints = gameMap.river,
    riverEndpoints = [riverPoints[0], riverPoints[riverPoints.length - 1]]
  for (const riverEndpoint of riverEndpoints) {
    const riverMouthFogX = Math.sign(riverEndpoint.x) * (gameMap.bound - 6)
    atmosphereSprites.push({ kind: "fog", x: riverMouthFogX, y: WATER_LEVEL + 0.4, z: Math.sign(riverEndpoint.y) * (gameMap.bound - 6), width: 13, color: fogColor, alpha: 0.11 })
  }
  for (let bankFogX = -gameMap.bound + 10; bankFogX < gameMap.bound - 8; bankFogX += 19) atmosphereSprites.push({ kind: "fog", x: bankFogX + atmosphereRandom.range(-3, 3), y: -1.3, z: gameMap.bound + 5.5, width: atmosphereRandom.range(11, 14), color: fogColor, alpha: 0.1 })
  for (let shuffleIndex = atmosphereSprites.length - 1; shuffleIndex > 0; shuffleIndex--) {
    const intResult = atmosphereRandom.int(shuffleIndex + 1),
      selectedR = atmosphereSprites[shuffleIndex]
    ;((atmosphereSprites[shuffleIndex] = atmosphereSprites[intResult]), (atmosphereSprites[intResult] = selectedR))
  }
  const lengthValue = atmosphereSprites.length,
    element = new PlaneGeometry(1, 1)
  element.translate(0, 0.5, 0)
  const float32Array = new Float32Array(lengthValue * 4),
    spriteKindData = new Float32Array(lengthValue * 2),
    atmosphereMaterial = new ShaderMaterial({
      uniforms: { tNoise: { value: noiseTexture }, uTime: ARENA_SHARED_UNIFORMS.uTime },
      vertexShader: UNIT_ATTRIBUTE_VERTEX_SHADER,
      fragmentShader: UNIT_ATTRIBUTE_FRAGMENT_SHADER,
      transparent: !0,
      depthWrite: !1,
      side: DoubleSide,
      premultipliedAlpha: !0,
      blending: CustomBlending,
      blendSrc: OneFactor,
      blendDst: OneMinusSrcAlphaFactor,
      blendSrcAlpha: OneFactor,
      blendDstAlpha: OneMinusSrcAlphaFactor,
      fog: !1,
    }),
    atmosphereMesh = new InstancedMesh(element, atmosphereMaterial, Math.max(1, lengthValue)),
    spriteTransform = new Matrix4(),
    basisX = new Vector3(),
    vector3 = new Vector3(),
    basisZ = new Vector3(),
    spritePosition = new Vector3()
  ;(atmosphereSprites.forEach((position, spriteIndex) => {
    const spriteLength = position.length ?? 1
    ;(position.kind === "beam"
      ? (vector3.copy(SUN_DIRECTION),
        basisX.crossVectors(vector3, UNIT_ATTRIBUTE_DECLS).normalize(),
        basisZ.crossVectors(basisX, vector3).normalize(),
        spritePosition.set(position.x, position.y, position.z).addScaledVector(vector3, -spriteLength * 0.12),
        spriteTransform.makeBasis(basisX.multiplyScalar(position.width), vector3.clone().multiplyScalar(spriteLength), basisZ).setPosition(spritePosition))
      : position.kind === "fog"
        ? (basisX.set(position.width, 0, 0), vector3.set(0, 0, position.width), basisZ.set(0, 1, 0), spriteTransform.makeBasis(basisX, vector3, basisZ).setPosition(position.x, position.y, position.z - position.width / 2))
        : (basisX.set(position.width, 0, 0), vector3.set(0, spriteLength, 0), basisZ.set(0, 0, 1), spriteTransform.makeBasis(basisX, vector3, basisZ).setPosition(position.x, position.y, position.z)),
      atmosphereMesh.setMatrixAt(spriteIndex, spriteTransform),
      float32Array.set([position.color[0], position.color[1], position.color[2], position.alpha], spriteIndex * 4),
      spriteKindData.set([position.kind === "beam" ? 0 : position.kind === "fog" ? 1 : 2, atmosphereRandom.next()], spriteIndex * 2))
  }),
    element.setAttribute("aTint", new InstancedBufferAttribute(float32Array, 4)),
    element.setAttribute("aKind", new InstancedBufferAttribute(spriteKindData, 2)),
    (atmosphereMesh.instanceMatrix.needsUpdate = !0),
    (atmosphereMesh.name = "atmos"),
    (atmosphereMesh.renderOrder = 6),
    (atmosphereMesh.frustumCulled = !1),
    (atmosphereMesh.matrixAutoUpdate = !1))
  const applyQuality = (kills) => {
    ;((atmosphereMesh.visible = kills.atmos > 0 && lengthValue > 0), (atmosphereMesh.count = kills.atmos >= 2 ? lengthValue : Math.ceil(lengthValue / 2)))
  }
  return (applyQuality(qualitySettings), { mesh: atmosphereMesh, count: lengthValue, setQuality: applyQuality })
}

export { buildAtmosphereLayer }
