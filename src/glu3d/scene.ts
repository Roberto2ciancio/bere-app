import {
  AmbientLight,
  BufferGeometry,
  CapsuleGeometry,
  Camera,
  CircleGeometry,
  ConeGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  LatheGeometry,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  Plane,
  Scene,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'
import type { Pose } from './poses'

export interface RendererLike {
  setPixelRatio(r: number): void
  setSize(w: number, h: number, style?: boolean): void
  render(scene: Scene, camera: Camera): void
  dispose(): void
  localClippingEnabled: boolean
  getContext(): WebGLRenderingContext | WebGL2RenderingContext
  forceContextLoss?(): void
}

export interface GluScene {
  applyPose(p: Pose): void
  render(): void
  resize(cssPx: number, dpr: number): void
  setTheme(dark: boolean): void
  dispose(): void
  /** Solo per la prova del telefono: restituisce subito il contesto WebGL. */
  releaseContext?(): void
  readonly root: Group
  readonly gl: WebGLRenderingContext | WebGL2RenderingContext | null
}

type Canvas = HTMLCanvasElement | OffscreenCanvas

// Il prototipo è modellato in unità da ~80 (raggio): le unità di Pose (0,35 di salto max)
// si scalano con questo fattore.
const U = 160
const WATER_BOTTOM = -72
const WATER_TOP = 85
// Inquadratura. Il riquadro di Glu (.progress-ring-art) inquadra y BODY_CY ± ART_HALF, come il Glu 2D.
// La tela è più grande del riquadro (home.css: inset -36% sopra, -18% ai lati, 0 sotto → 136%):
// sopra c'è posto per il salto (ciuffo a 163) e la corona da 30 in salto (~190), ai lati per il ventaglio.
const BODY_CY = 5
const ART_HALF = 108
const PAD_TOP = 0.36
const PAD_SIDE = 0.18
const VIEW_HALF = ART_HALF * (1 + 2 * PAD_SIDE)
const VIEW_CY = BODY_CY + ART_HALF * (PAD_TOP - (2 * PAD_SIDE - PAD_TOP))
const FOOT_Y = -76
const STEP_LIFT = 14
const INK_LIGHT = 0x0b2545
const INK_DARK = 0x071a33

function defaultRenderer(canvas: Canvas): RendererLike {
  const dpr = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1
  return new WebGLRenderer({ canvas, alpha: true, antialias: dpr < 2 })
}

export function createGluScene(
  canvas: Canvas,
  opts: { makeRenderer?: (c: Canvas) => RendererLike; dark?: boolean } = {},
): GluScene {
  const renderer = (opts.makeRenderer ?? defaultRenderer)(canvas)
  renderer.localClippingEnabled = true
  let gl: WebGLRenderingContext | WebGL2RenderingContext | null = null
  try {
    gl = renderer.getContext?.() ?? null
  } catch {
    gl = null
  }

  const scene = new Scene()
  const fov = 25
  const camera = new PerspectiveCamera(fov, 1, 100, 4000)
  // A riposo Glu (da -93 a 107) riempie l'anello come quello 2D; salto e corona usano il margine della tela.
  camera.position.set(0, VIEW_CY, VIEW_HALF / Math.tan(((fov / 2) * Math.PI) / 180))
  camera.lookAt(0, VIEW_CY, 0)

  scene.add(new AmbientLight(0xffffff, 1.6))
  const key = new DirectionalLight(0xffffff, 2.6)
  key.position.set(-400, 600, 900)
  scene.add(key)
  const rim = new DirectionalLight(0x9fdcff, 1.0)
  rim.position.set(500, -100, 300)
  scene.add(rim)

  const root = new Group()
  scene.add(root)
  const g = new Group()
  root.add(g)

  const named = <T extends Object3D>(o: T, name: string): T => {
    o.name = name
    return o
  }

  // Profilo a goccia (come nel prototipo)
  const pts: Vector2[] = []
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI
    let y = -Math.cos(a)
    const r = Math.sin(a) * (1 - 0.16 * y)
    y *= y > 0 ? 1.12 : 0.94
    pts.push(new Vector2(r * 80, y * 80))
  }
  const bodyGeo = new LatheGeometry(pts, 64)
  const plane = new Plane(new Vector3(0, -1, 0), WATER_TOP)

  const water = named(
    new Mesh(
      bodyGeo,
      new MeshPhysicalMaterial({ color: 0x19a0e8, roughness: 0.3, side: DoubleSide, clippingPlanes: [plane] }),
    ),
    'water',
  )
  water.scale.setScalar(0.94)
  g.add(water)

  const body = named(
    new Mesh(
      bodyGeo,
      new MeshPhysicalMaterial({
        color: 0xcfebfb,
        transparent: true,
        opacity: 0.5,
        roughness: 0.12,
        clearcoat: 1,
        clearcoatRoughness: 0.1,
        depthWrite: false,
      }),
    ),
    'body',
  )
  body.renderOrder = 1
  g.add(body)

  const ink = new MeshStandardMaterial({ color: INK_LIGHT, roughness: 0.25, transparent: true })
  const white = new MeshBasicMaterial({ color: 0xffffff, transparent: true })

  const eyeMeshes: Mesh[] = []
  const eyes = ([-1, 1] as const).map((s) => {
    const e = new Group()
    const m = new Mesh(new SphereGeometry(10, 24, 16), ink)
    m.scale.set(1, 1.3, 0.5)
    m.renderOrder = 2
    const glint = new Mesh(new SphereGeometry(3, 12, 8), white)
    glint.position.set(3, 5, 5)
    glint.renderOrder = 3
    e.add(m, glint)
    e.position.set(s * 24, 14, 74)
    e.rotation.y = s * 0.3
    // Glu guarda lo spettatore: la sua sinistra è a destra dello schermo.
    named(e, s < 0 ? 'eyeR' : 'eyeL')
    eyeMeshes.push(m)
    g.add(e)
    return e
  })

  const smile = named(new Mesh(new TorusGeometry(11, 2.4, 10, 24, Math.PI), ink), 'mouthSmile')
  smile.rotation.z = Math.PI
  smile.position.set(0, -8, 80)
  smile.renderOrder = 2
  g.add(smile)
  const mouth = named(new Mesh(new SphereGeometry(8, 20, 14), ink), 'mouthOpen')
  mouth.scale.set(1, 1.15, 0.4)
  mouth.position.set(0, -16, 80)
  mouth.renderOrder = 2
  g.add(mouth)

  const limb = new MeshPhysicalMaterial({ color: 0x8ccdf2, roughness: 0.2, clearcoat: 1 })
  const arms = ([-1, 1] as const).map((s) => {
    const p = new Group()
    const m = new Mesh(new CapsuleGeometry(8, 16, 6, 14), limb)
    m.position.y = -14
    p.add(m)
    p.position.set(s * 73, -2, 0)
    // Braccio destro di Glu = lato sinistro dello schermo.
    named(p, s < 0 ? 'armR' : 'armL')
    g.add(p)
    return p
  })
  const footMat = new MeshPhysicalMaterial({ color: 0x19a0e8, roughness: 0.3 })
  const feet = ([-1, 1] as const).map((s) => {
    const f = named(new Mesh(new SphereGeometry(17, 20, 14), footMat), s < 0 ? 'footR' : 'footL')
    f.scale.set(1, 0.5, 1.25)
    f.position.set(s * 27, FOOT_Y, 10)
    g.add(f)
    return f
  })

  const tuft = named(new Mesh(new SphereGeometry(10, 20, 14), limb), 'tuft')
  tuft.scale.set(0.85, 1.7, 0.85)
  tuft.position.set(8, 90, 0)
  tuft.rotation.z = -0.55
  g.add(tuft)

  const shadow = named(
    new Mesh(
      new CircleGeometry(60, 40),
      new MeshBasicMaterial({ color: 0x0b2545, transparent: true, opacity: 0.14, depthWrite: false }),
    ),
    'shadow',
  )
  shadow.scale.y = 0.16
  shadow.position.set(0, -92, 0)
  root.add(shadow)

  // Accessori
  const headband = named(
    new Mesh(new TorusGeometry(70, 5, 10, 48), new MeshStandardMaterial({ color: 0xe8505b, roughness: 0.5 })),
    'headband',
  )
  headband.rotation.x = Math.PI / 2
  headband.position.set(0, 52, 0)
  headband.scale.set(0.93, 0.93, 1)
  g.add(headband)

  const sweat = named(
    new Mesh(
      new SphereGeometry(7, 16, 12),
      new MeshPhysicalMaterial({ color: 0x9fdcff, roughness: 0.1, transparent: true, opacity: 0.85 }),
    ),
    'sweat',
  )
  sweat.scale.set(0.8, 1.3, 0.8)
  sweat.position.set(58, 42, 62)
  g.add(sweat)

  const crownTiers: [string, number, number][] = [
    ['crown7', 0xcd7f32, 14],
    ['crown14', 0xc0c8d0, 18],
    ['crown30', 0xffc83d, 24],
  ]
  const crowns = crownTiers.map(([name, color, size]) => {
    const c = named(
      new Mesh(
        new ConeGeometry(size, size * 1.3, 5),
        new MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.6 }),
      ),
      name,
    )
    c.position.set(0, 104 + size * 0.4, 0)
    g.add(c)
    return c
  })

  // Ventaglio a spicchio nella mano destra (come quello 2D): segue la rotazione del braccio.
  const fan = named(
    new Mesh(
      new CircleGeometry(26, 24, -0.8 * Math.PI, 0.6 * Math.PI),
      new MeshStandardMaterial({ color: 0xffe1a8, roughness: 0.6, transparent: true, opacity: 0.9, side: DoubleSide }),
    ),
    'fan',
  )
  fan.position.set(0, -26, 6)
  arms[0].add(fan)

  const zzz = named(
    new Mesh(new TorusGeometry(10, 2.6, 8, 16, Math.PI * 1.5), new MeshBasicMaterial({ color: 0x47607d })),
    'zzz',
  )
  zzz.position.set(70, 85, 40)
  g.add(zzz)

  headband.visible = sweat.visible = fan.visible = zzz.visible = false
  crowns.forEach((c) => (c.visible = false))
  mouth.visible = false

  const crownBaseY = crowns.map((c) => c.position.y)

  function applyPose(p: Pose) {
    const lift = p.jumpY + p.bob
    g.position.set(p.shakeX * U, lift * U, 0)
    g.rotation.y = p.lookY + p.turnY
    // feet[0] è il piede destro di Glu (s -1, 'footR'), feet[1] il sinistro.
    feet[0].position.y = FOOT_Y + p.stepR * STEP_LIFT
    feet[1].position.y = FOOT_Y + p.stepL * STEP_LIFT
    body.scale.y = p.scaleY
    water.scale.set(0.94, 0.94 * p.scaleY, 0.94)
    shadow.scale.x = 1 - Math.min(0.4, p.jumpY * 1.2)
    // Braccio destro (schermo sinistro) ruota in z negativo: su verso il cielo.
    arms[0].rotation.z = -p.armR
    arms[1].rotation.z = p.armL
    for (const m of eyeMeshes) m.scale.y = 1.3 * Math.max(0.05, p.eyeOpen)
    eyes[0].rotation.x = eyes[1].rotation.x = -p.lookY * 0.1

    // 'big' e 'open' usano la bocca aperta (più grande per 'big'); 'small' è il sorriso ridotto.
    mouth.visible = p.mouth === 'open' || p.mouth === 'big'
    smile.visible = !mouth.visible
    smile.scale.setScalar(p.mouth === 'small' ? 0.6 : 1)
    mouth.scale.set(p.mouth === 'big' ? 1.5 : 1, p.mouth === 'big' ? 1.7 : 1.15, 0.4)

    ;(body.material as MeshPhysicalMaterial).color.set(p.bodyColor)

    // Piano di clipping in coordinate mondo: segue il salto; l'inclinazione ruota la normale attorno all'asse di vista (z).
    const th = (p.waterTilt * Math.PI) / 180
    plane.normal.set(Math.sin(th), -Math.cos(th), 0)
    const level = Math.min(1, Math.max(0, p.waterLevel))
    plane.constant = WATER_BOTTOM + (WATER_TOP - WATER_BOTTOM) * level + lift * U

    headband.visible = p.headband
    sweat.visible = p.sweat
    fan.visible = p.fan
    zzz.visible = p.zzz
    crowns.forEach((c, i) => {
      c.visible = p.crown === (i === 0 ? 7 : i === 1 ? 14 : 30)
      c.position.y = crownBaseY[i] + p.crownDropY * U
    })
  }

  function setTheme(dark: boolean) {
    ink.color.setHex(dark ? INK_DARK : INK_LIGHT)
    rim.intensity = dark ? 2.0 : 1.0
  }

  function resize(cssPx: number, dpr: number) {
    renderer.setPixelRatio(Math.min(2, dpr))
    renderer.setSize(cssPx, cssPx, false)
  }

  function dispose() {
    const geos = new Set<BufferGeometry>()
    const mats = new Set<Material>()
    scene.traverse((o) => {
      const m = o as Mesh
      if (m.geometry) geos.add(m.geometry)
      if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => mats.add(x))
    })
    geos.forEach((x) => x.dispose())
    mats.forEach((x) => x.dispose())
    renderer.dispose()
  }

  setTheme(!!opts.dark)

  return {
    applyPose,
    render: () => renderer.render(scene, camera),
    resize,
    setTheme,
    dispose,
    releaseContext: () => renderer.forceContextLoss?.(),
    root,
    gl,
  }
}
