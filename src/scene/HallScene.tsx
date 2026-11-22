"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, OrbitControls, Sky, Stars } from "@react-three/drei";
import { totalHeightM } from "@/configurator/calculations/layout";
import type { HallConfig } from "@/configurator/schema/config";
import type { HighlightId, SectionId } from "@/configurator/state/ui-store";
import { CameraRig } from "./CameraRig";
import { DEFAULT_FOV, presetPose, type ViewPreset } from "./camera";
import { Dimensions3D } from "./Dimensions3D";
import { HallModel } from "./HallModel";
import { Landscape } from "./LandscapeView";
import { layoutLandscape } from "./landscape";
import { boundingRadius, layoutSurroundings } from "./layout";
import type { SceneLook } from "./options";
import { Surroundings } from "./Surroundings";
import { createLandscapeTextures, createSceneTextures, disposeLandscapeTextures, disposeTextures } from "./textures";
import { MinimalSite } from "./MinimalSite";
import { PocketPark } from "./PocketPark";
import { TrafficProvider } from "./TrafficContext";
import { ServiceTraffic } from "./ServiceTraffic";
import { QUALITY_TIERS, createGovernor, dprFor, observeFrame, resetWindow, type Quality } from "./perf";
import { SUN_DIR } from "./sun";
import { Traffic } from "./TrafficView";
import { DockTrucks } from "./DockTrucksView";
import { buildTraffic } from "./traffic";
import { useBuildAnimation, type BuildAnim } from "./useBuildAnimation";

export interface HallSceneProps {
  config: HallConfig;
  /** Vzhled odvozený z voleb katalogu. */
  look: SceneLook;
  preset: ViewPreset;
  nonce: number;
  night: boolean;
  roofExploded: boolean;
  roofHidden: boolean;
  showDimensions: boolean;
  highlight: HighlightId;
  onPick: (section: SectionId) => void;
  onContextLost: () => void;
  touchRotate: boolean;
  reducedMotion: boolean;
  /** Živé prostředí: doprava, plynoucí mraky. Vypnuté při úspoře pohybu (a volitelně uživatelem). */
  live: boolean;
  /** Default: calm studio. The surrounding site is an optional presentation layer. */
  siteVisible: boolean;
  /** Zavolá se po vykreslení prvních snímků (kompilace shaderů a textur je hotová). */
  onReady?: () => void;
  fixedPose?: { position: [number, number, number]; target: [number, number, number] } | null;
  /** Ladění: ?ao=0 vypne ambient occlusion, ?fx=0 vypne celý postprocessing. */
  debug?: { ao: boolean; fx: boolean };
}

const DAY = { fog: "#cddbe8", ground: "#a7b59d" };
const NIGHT = { fog: "#0c1a36", ground: "#16241f" };
// Slunce níž nad obzorem: delší, čitelnější stíny.


function Lighting({ night, extent, build, light }: { night: boolean; extent: number; build: BuildAnim; light: RefObject<THREE.DirectionalLight | null> }) {

  useLayoutEffect(() => {
    const l = light.current;
    if (!l) return;
    const cam = l.shadow.camera;
    cam.left = -extent;
    cam.right = extent;
    cam.top = extent;
    cam.bottom = -extent;
    cam.near = 1;
    cam.far = extent * 5;
    cam.updateProjectionMatrix();
    l.shadow.bias = -0.0004;
    l.shadow.normalBias = 0.12;
    // Statická scéna je cachovaná; pohybující se kamiony vyžádají omezené aktualizace zvlášť.
    l.shadow.autoUpdate = false;
  }, [extent, light]);

  // Každé překreslení Reactu (změna konfigurace, den/večer, střecha) = nová stínová mapa.
  useEffect(() => {
    if (light.current) light.current.shadow.needsUpdate = true;
  });
  useFrame(() => {
    if (light.current && build.busy.current) light.current.shadow.needsUpdate = true;
  });

  return (
    <>
      {/* ambient a odrazy dodává prostředí (Environment); přímé světlo je jen slunce nebo měsíc */}
      <hemisphereLight args={[night ? "#40588c" : "#dfeaf6", night ? "#10151c" : "#9a9f94", night ? 0.45 : 0.22]} />
      <directionalLight
        ref={light}
        castShadow
        intensity={night ? 0.9 : 3.0}
        color={night ? "#9db4ee" : "#fff0d8"}
        position={[SUN_DIR.x * extent * 1.4, SUN_DIR.y * extent * 1.4, SUN_DIR.z * extent * 1.4]}
        shadow-mapSize={[2048, 2048]}
      />
    </>
  );
}

/**
 * Lokálně generované prostředí (bez stahování HDR): měkké světelné karty dávají kovovým panelům a sklu věrohodné odrazy.
 */
function Studio({ night }: { night: boolean }) {
  const k = night ? 0.18 : 1;
  return (
    <Environment resolution={256} frames={1} environmentIntensity={night ? 0.5 : 0.55}>
      <color attach="background" args={[night ? "#0c1630" : "#9fb8d3"]} />
      <Lightformer form="rect" intensity={2.2 * k} position={[0, 12, 0]} rotation-x={Math.PI / 2} scale={[40, 40, 1]} color={night ? "#6f86c0" : "#f2f7ff"} />
      <Lightformer form="rect" intensity={3.2 * k} position={[12, 6, 8]} rotation-y={-Math.PI / 2.6} scale={[16, 6, 1]} color={night ? "#8ea2d6" : "#fff2dd"} />
      <Lightformer form="rect" intensity={1.4 * k} position={[-14, 4, -6]} rotation-y={Math.PI / 2.4} scale={[18, 5, 1]} color={night ? "#5a70aa" : "#dce8f6"} />
      <Lightformer form="ring" intensity={1.2 * k} position={[0, 3, -14]} scale={9} color="#ffffff" />
    </Environment>
  );
}

function Atmosphere({ night, radius, siteVisible }: { night: boolean; radius: number; siteVisible: boolean }) {
  const t = night ? NIGHT : DAY;
  if (!siteVisible) return <>
    <color attach="background" args={[night ? "#19232d" : "#edf0ed"]} />
    <fog attach="fog" args={[night ? "#19232d" : "#edf0ed", Math.max(250, radius * 3), Math.max(1100, radius * 9)]} />
    <mesh rotation-x={-Math.PI / 2} position={[0, -0.5, 0]} receiveShadow>
      <planeGeometry args={[9000, 9000]} /><meshStandardMaterial color={night ? "#25313b" : "#dfe4de"} roughness={0.95} />
    </mesh>
  </>;
  return (
    <>
      {night ? <color attach="background" args={["#0a1530"]} /> : <Sky distance={3200} sunPosition={SUN_DIR.toArray()} turbidity={3.2} rayleigh={0.9} mieCoefficient={0.004} mieDirectionalG={0.82} />}
      {night && <Stars radius={1200} depth={60} count={1800} factor={6} fade speed={0} />}
      {/* Mlha jen měkce zahalí daleký horizont; kopce a pole zůstávají v dálce čitelné. */}
      <fog attach="fog" args={[t.fog, Math.max(700, radius * 7), Math.max(3200, radius * 16)]} />
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.12, 0]} receiveShadow>
        <planeGeometry args={[9000, 9000]} />
        <meshStandardMaterial color={t.ground} roughness={1} />
      </mesh>
    </>
  );
}

/** Mobil: bez zapnutého ovládání nechá jednoprstový svislý tah posouvat stránku. */
function TouchPolicy({ touchRotate }: { touchRotate: boolean }) {
  const dom = useThree((s) => s.gl.domElement);
  useEffect(() => {
    const coarse = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
    dom.style.touchAction = coarse && !touchRotate ? "pan-y" : "none";
  }, [dom, touchRotate]);
  return null;
}

function ClampTarget({ config }: { config: HallConfig }) {
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; addEventListener: (t: string, f: () => void) => void; removeEventListener: (t: string, f: () => void) => void } | null;
  useEffect(() => {
    if (!controls) return;
    const { lengthM: L, widthM: W } = config.dimensions;
    const H = totalHeightM(config.dimensions.clearHeightM);
    const clamp = () => {
      const t = controls.target;
      t.x = THREE.MathUtils.clamp(t.x, -L / 2 - 60, L / 2 + 60);
      t.z = THREE.MathUtils.clamp(t.z, -W / 2 - 60, W / 2 + 60);
      t.y = THREE.MathUtils.clamp(t.y, 0, H * 1.2);
    };
    controls.addEventListener("change", clamp);
    return () => controls.removeEventListener("change", clamp);
  }, [controls, config.dimensions]);
  return null;
}

/**
 * Traffic needs a steady clock, but a static architectural scene does not need 120 GPU frames/s.
 * Na pomalém zařízení by stálá smyčka držela vykreslování pořád v plné zátěži a změny z panelu by se zařazovaly
 * až za ni (rozhraní "zamrzne"). Hlídač (perf.ts) proto při trvale pomalých snímcích sníží frekvenci a rozlišení
 * a nakonec živý provoz pozastaví; změny a animace dál vykreslují sami na vyžádání.
 */
function LiveFrames({ active, build }: { active: boolean; build: BuildAnim }) {
  const invalidate = useThree((s) => s.invalidate);
  const setDpr = useThree((s) => s.setDpr);
  const governor = useRef(createGovernor());
  const [quality, setQuality] = useState<Quality>(0);
  const everyMs = QUALITY_TIERS[quality].liveMs;

  useEffect(() => {
    if (!active || everyMs === 0) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) invalidate();
    }, everyMs);
    invalidate();
    return () => window.clearInterval(timer);
  }, [active, everyMs, invalidate]);

  // Provoz vypnutý (nebo ještě nezačal): zapnutí dá zařízení novou šanci, kvalita se vrací na plnou.
  useEffect(() => {
    if (active) return;
    governor.current = createGovernor();
    setQuality(0);
    setDpr(dprFor(0, window.devicePixelRatio));
  }, [active, setDpr]);

  useFrame((_, delta) => {
    // Měří se jen klidový provoz; stavba a přechody mají vlastní, krátkodobou zátěž.
    if (!active || build.busy.current) {
      resetWindow(governor.current);
      return;
    }
    const next = observeFrame(governor.current, delta * 1000);
    if (next !== quality) {
      setQuality(next);
      setDpr(dprFor(next, window.devicePixelRatio));
    }
  });
  return null;
}

function SceneContent(props: HallSceneProps & { compiled: boolean; onCompiled: () => void }) {
  const { config, night, preset, live } = props;
  const sunlight = useRef<THREE.DirectionalLight>(null);
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);

  // Shadery se před prvním snímkem kompilují asynchronně a paralelně (KHR_parallel_shader_compile): stránka zůstane
  // odezvová a stavba se nezačne přehrávat uprostřed zásekem. Pojistka: po 10 s se pokračuje i bez dokončení.
  useEffect(() => {
    let alive = true;
    const done = () => alive && props.onCompiled();
    const guard = window.setTimeout(done, 10_000);
    gl.compileAsync(scene, camera)
      .catch(() => undefined)
      .finally(() => {
        window.clearTimeout(guard);
        done();
      });
    return () => {
      alive = false;
      window.clearTimeout(guard);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (props.compiled) invalidate();
  }, [props.compiled, invalidate]);
  const textures = useMemo(() => createSceneTextures(), []);
  const landTextures = useMemo(() => createLandscapeTextures(), []);
  useEffect(() => () => disposeTextures(textures), [textures]);
  useEffect(() => () => disposeLandscapeTextures(landTextures), [landTextures]);

  // Režisér stavby: zobrazená (animovaná) konfigurace + průběh přehrání stavby a vyrůstání vybavení.
  const build = useBuildAnimation(config, props.reducedMotion);
  const frames = useRef(0);
  useFrame(() => {
    if (frames.current < 3) {
      if (++frames.current === 3) props.onReady?.();
      else invalidate(); // reduced motion also uses the demand loop: schedule the warm-up frames
    }
  });
  const shown = build.shown;

  const radius = boundingRadius(config);
  const extent = Math.max(config.dimensions.lengthM, config.dimensions.widthM) * 0.7 + 70;

  // Plochy areálu rostou se zobrazenou halou; vybavení a okolí se rozmísťuje podle cíle a po doběhu vyroste.
  const shownKey = JSON.stringify([shown.dimensions, shown.openings, shown.office]);
  const targetKey = JSON.stringify([config.dimensions, config.openings, config.office]);
  /* eslint-disable react-hooks/exhaustive-deps */
  const slabLayout = useMemo(() => layoutSurroundings(shown), [shownKey]);
  const layout = useMemo(() => layoutSurroundings(config), [targetKey]);
  const landSlab = useMemo(() => layoutLandscape(slabLayout), [slabLayout]);
  const landTarget = useMemo(() => layoutLandscape(layout), [layout]);
  const vehicles = useMemo(() => buildTraffic(layout), [layout]);
  /* eslint-enable react-hooks/exhaustive-deps */

  return (
    <>
      <LiveFrames active={props.compiled && live} build={build} />
      <Atmosphere night={night} radius={radius} siteVisible={props.siteVisible} />
      <Studio night={night} />
      <Lighting night={night} extent={extent} build={build} light={sunlight} />
      <TrafficProvider config={config} layout={layout} dockHouse={props.look.dock.house} minimalist={!props.siteVisible} live={live} build={build}>
      <HallModel
        config={shown}
        target={config}
        build={build}
        look={props.look}
        live={live && props.siteVisible}
        indoorLive={live}
        section={props.preset === "section"}
        roofExploded={props.roofExploded}
        roofHidden={props.roofHidden}
        night={night}
        highlight={props.highlight}
        onPick={props.onPick}
        textures={textures}
      />
      {props.siteVisible ? <>
        <Surroundings layout={layout} slabLayout={slabLayout} night={night} textures={textures} build={build} serviceEnabled={config.openings.dockCount + config.openings.driveInCount > 0} />
        <Landscape land={landSlab} hedges={landTarget.hedges} forest={landTarget.forest} night={night} textures={landTextures} live={live} />
        <Traffic vehicles={vehicles} night={night} live={live} ready={build.env} />
      </> : <MinimalSite config={shown} dockHouse={props.look.dock.house} layout={slabLayout} night={night} live={live} build={build} />}

      <PocketPark layout={slabLayout} night={night} build={build} includePatio={!props.siteVisible} />

      <DockTrucks layout={layout} widthM={config.dimensions.widthM} dockHouse={props.look.dock.house} night={night} live={live} ready={build.env} clock={build.operationTime} shadowLight={sunlight} />
      <ServiceTraffic config={config} dockHouse={props.look.dock.house} build={build} />
      </TrafficProvider>

      {(props.showDimensions || props.highlight === "dimensions") && <Dimensions3D config={shown} night={night} />}
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.09}
        minDistance={preset === "interior" ? 1.5 : 8}
        maxDistance={radius * 5}
        maxPolarAngle={Math.PI / 2 - 0.02}
        rotateSpeed={0.7}
        zoomSpeed={0.8}
        regress
        zoomToCursor
      />
      <ClampTarget config={config} />
      <CameraRig config={config} preset={props.preset} nonce={props.nonce} reducedMotion={props.reducedMotion} fixedPose={props.fixedPose} />
      <TouchPolicy touchRotate={props.touchRotate} />

    </>
  );
}

export default function HallScene(props: HallSceneProps) {
  const [compiled, setCompiled] = useState(false);
  const initial = useMemo(() => presetPose("perspective", props.config, 1.6, DEFAULT_FOV), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Canvas
      shadows="percentage"
      dpr={[1, 2]}
      // Stavba a ovládání invalidují samy, provoz dostává nejvýš 30 pravidelných snímků/s.
      frameloop={!compiled ? "never" : "demand"}
      camera={{ fov: DEFAULT_FOV, near: 0.8, far: 4200, position: initial.position }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.localClippingEnabled = true;
        gl.toneMapping = THREE.AgXToneMapping;
        gl.domElement.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
          props.onContextLost();
        });
      }}
      aria-label="Interaktivní 3D model haly"
    >
      <SceneContent {...props} compiled={compiled} onCompiled={() => setCompiled(true)} />
    </Canvas>
  );
}
