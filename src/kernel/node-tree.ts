/**
 * 通用节点树 NodeTree —— 层级关节容器（名字 / 父节点 / 绑定坐标 / 局部坐标 / 命名链）
 * ---------------------------------------------------------------
 * 音频骨架与角色骨架共用：每个节点记录绑定姿势坐标，派生相对父节点的局部坐标。
 *
 * 坐标存储：bind / local 均为扁平数组，第 i 个节点的分量为 [i*3]、[i*3+1]、[i*3+2]。
 * 方法 bx/by/bz 是「绑定坐标分量」的缩写访问器（bindX/bindY/bindZ），
 * 因调用点较多且短名已在多处使用，这里保留原名并在此说明。
 */

/** 命名链的物理摆动配置：joints 为关节 id 序列，tip 为末端目标偏移，其余为 Verlet 参数。 */
export interface SkeletonChainConfig {
  joints: number[]
  tip: [number, number, number]
  stiffness: number
  drag: number
  gravity?: number
  maxAngle: number
  wind?: number
  colliders?: Array<{ joint: number; x: number; y: number; z: number; r: number }>
}

export class NodeTree {
  /** 关节名，下标即关节 id */
  readonly names: string[] = []
  /** 每个关节的父关节 id，根节点为 -1 */
  readonly parent: number[] = []
  /** 绑定姿势坐标（扁平存储） */
  readonly bind: number[] = []
  /** 相对父节点的局部坐标（扁平存储） */
  readonly local: number[] = []
  /**
   * 命名链的物理配置（辫子、马尾、围巾等）。
   * joints 为关节 id 序列，tip 为末端目标偏移，其余为 Verlet 摆动参数。
   */
  readonly chains: SkeletonChainConfig[] = []

  get count(): number {
    return this.names.length
  }

  /** 追加一个关节，返回其 id */
  add(pelvis: string, parentId: number, bindX: number, chestY: number, bindZ: number): number {
    const jointId = this.names.length
    this.names.push(pelvis)
    this.parent.push(parentId)
    this.bind.push(bindX, chestY, bindZ)
    if (parentId >= 0) {
      const parentBindOffset = parentId * 3
      this.local.push(bindX - this.bind[parentBindOffset], chestY - this.bind[parentBindOffset + 1], bindZ - this.bind[parentBindOffset + 2])
    } else {
      this.local.push(bindX, chestY, bindZ)
    }
    return jointId
  }

  /**
   * 批量追加一条链（关节名依次为 `${prefix}0`、`${prefix}1`…），返回 id 列表。
   * joints 为每节的 [x, y, z]。
  */
  addChain(prefix: string, parentId: number, joints: number[][]): number[] {
    const jointIds: number[] = []
    let currentParent = parentId
    joints.forEach((coords, index) => {
      currentParent = this.add(`${prefix}${index}`, currentParent, coords[0], coords[1], coords[2])
      jointIds.push(currentParent)
    })
    return jointIds
  }

  /** 登记一条命名链的物理配置（供 skeleton-solver 的 Verlet 摆动使用） */
  chain(config: SkeletonChainConfig): void {
    this.chains.push(config)
  }

  /** 按关节名查 id，找不到即抛错（骨架定义写错时尽早暴露） */
  id(jointName: string): number {
    const jointId = this.names.indexOf(jointName)
    if (jointId < 0) throw new Error(`rig: 没有关节 ${jointName}`)
    return jointId
  }

  /** 绑定坐标 x 分量 */
  bx(jointId: number): number {
    return this.bind[jointId * 3]
  }

  /** 绑定坐标 y 分量 */
  by(jointId: number): number {
    return this.bind[jointId * 3 + 1]
  }

  /** 绑定坐标 z 分量 */
  bz(jointId: number): number {
    return this.bind[jointId * 3 + 2]
  }
}
