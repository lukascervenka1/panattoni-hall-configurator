"use client";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { useFrame, useThree } from "@react-three/fiber";
import { DEMO_GEOMETRY as G } from "@/configurator/calculations/constants";
import { columnFrame, placeOpenings, type PlacedOpening, officeLayout, pointInFootprint, totalHeightM } from "@/configurator/calculations/layout";
import type { HallConfig } from "@/configurator/schema/config";
import type { HighlightId, SectionId } from "@/configurator/state/ui-store";
import { buildOpeningDetails, buildFloor, buildFloorMarkings, buildLightPools, buildLightShafts, buildOffice, buildOfficeOutline, buildPartitions, buildPv, buildRoof, buildRoofDetails, buildShell } from "./geometry";
import { DampedStd, useAppear, useGrowY } from "./motion";
import { RoofFans } from "./RoofFans";
import { Robots } from "./RobotsView";
import { OfficeFurniture } from "./OfficeFurnitureView";
import { ROBOT, layoutRobotLanes, layoutRobots, layoutServiceRobot } from "./robots";
import { LightPools, LightShafts } from "./InteriorLight";
import { SUN_DIR } from "./sun";
import type { SceneLook } from "./options";
import { PV_CELL, layoutCeilingLights, layoutFloorMarkings, layoutGirders, layoutLightShafts, layoutHallHeating, layoutOfficeHeatPump, layoutPartitions, layoutPv, layoutRackParts, layoutRacks, layoutRoofUnits, layoutSkylights } from "./layout";
import { flatRect, TILE, type SceneTextures } from "./textures";
import { Instanced, type InstanceItem } from "./Instanced";
import type { BuildAnim } from "./useBuildAnimation";
import { gateCycle } from "./service";
import { useTrafficWorld } from "./TrafficContext";
import { useConstructionReveal } from "./useConstructionReveal";
import { HallSignage } from "./HallSignageView";
import { BuildingDetails } from "./BuildingDetailsView";

const SKY = "#93d50a"; // zvýraznění upravované části: limetková z brand manuálu (název konstanty zůstává)
const NAVY = "#001844";

export interface HallModelProps {
  /** Zobrazená (animovaná) konfigurace: z ní se staví konstrukce. */
  config: HallConfig;
  /** Cílová konfigurace: z ní se rozmísťuje vybavení, které se po doběhu růstu "vysází". */
  target: HallConfig;
  build: BuildAnim;
  /** Vzhled odvozený z vybraných voleb katalogu (barvy, varianty konstrukce, technologie). */
  look: SceneLook;
  roofExploded: boolean;
  roofHidden: boolean;
  night: boolean;
  /** Živé prostředí zapnuto (otáčejí se ventilátory). */
  live: boolean;
  /** Provoz uvnitř haly (skladoví roboti) běží i bez zobrazeného areálu. */
  indoorLive: boolean;
  /** Řez halou: čelní stěna (s administrativou) je odstraněná a vidět je do interiéru. */
  section: boolean;
  highlight: HighlightId;
  onPick: (section: SectionId) => void;
  textures: SceneTextures;
}

function useDispose(value: unknown) {
  useEffect(() => {
    return () => {
      if (!value || typeof value !== "object") return;
      for (const v of Object.values(value as Record<string, unknown>)) {
        if (v && typeof (v as THREE.BufferGeometry).dispose === "function") (v as THREE.BufferGeometry).dispose();
      }
    };
  }, [value]);
}

export function HallModel({ config, target, build, look, live, indoorLive, section, roofExploded, roofHidden, night, highlight, onPick, textures }: HallModelProps) {
  const gl = useThree((s) => s.gl);
  const invalidateRoof = useThree((s) => s.invalidate);
  const dims = config.dimensions;
  const H = totalHeightM(dims.clearHeightM);

  // Geometrie se přestavuje jen při změně rozměrů/otvorů/administrativy; změna materiálu ji nechá být.
  const shapeKey = JSON.stringify([config.dimensions, config.openings, config.office, config.daylight]);
  const dimKey = JSON.stringify(config.dimensions);
  const roofKey = JSON.stringify([config.dimensions, config.openings.dockCount > 0, config.daylight]);
  const targetKey = JSON.stringify([target.dimensions, target.office]);
  const floorRef = useRef<THREE.Group>(null);
  const wallsRef = useRef<THREE.Group>(null);
  const roofRef = useRef<THREE.Group>(null);
  const officeRef = useRef<THREE.Group>(null);
  const pvRef = useRef<THREE.Group>(null);
  const partitionRef = useRef<THREE.Group>(null);
  /* eslint-disable react-hooks/exhaustive-deps */
  const shell = useMemo(() => buildShell(config, { dockHouse: look.dock.house, omitOpeningDetails: true }), [shapeKey, look.dock.house]);
  const roof = useMemo(() => buildRoof(config.dimensions, TILE.membrane, layoutSkylights(config)), [roofKey]);
  const roofDetails = useMemo(() => buildRoofDetails(config), [roofKey]);
  const officeKey = JSON.stringify([config.dimensions, config.office]);
  const office = useMemo(() => buildOffice(config), [officeKey]);
  const officeOutline = useMemo(() => buildOfficeOutline(config), [officeKey]);
  const officeBox = useMemo(() => officeLayout(config), [officeKey]);
  const racks = useMemo(() => layoutRacks(target, look.partitions), [targetKey, look.partitions]);
  const partitionGeo = useMemo(() => buildPartitions(layoutPartitions(config, look.partitions), config.dimensions.clearHeightM), [dimKey, look.partitions]);
  const pv = useMemo(() => {
    const sky = layoutSkylights(config);
    return buildPv(layoutPv(config, look.pvShare, sky, layoutRoofUnits(config, sky)), config.dimensions.clearHeightM, PV_CELL);
  }, [roofKey, look.pvShare]);
  const girders = useMemo(() => layoutGirders(target, look.structure.girder, look.structure.girderColor), [targetKey, look.structure.girder, look.structure.girderColor]);
  const heating = useMemo(() => layoutHallHeating(target, look.heatingHall), [targetKey, look.heatingHall]);
  const heatPumps = useMemo(
    () => (look.heatingOffice === "heat_pump" ? layoutOfficeHeatPump(target).map((p) => ({ x: p.x, z: p.z, y: 0.7, sx: 1.0, sy: 1.3, sz: 0.55 })) : []),
    [targetKey, look.heatingOffice],
  );
  const rackParts = useMemo(() => layoutRackParts(racks.racks, racks.heightM), [racks]);
  const grid = useMemo(() => columnFrame(target.dimensions), [targetKey]);
  const robots = useMemo(() => {
    const service = layoutServiceRobot(target, racks.racks, look.partitions, grid.zs);
    return [...service, ...layoutRobots(layoutRobotLanes(racks.racks), grid.zs).slice(0, ROBOT.maxRobots - service.length)];
  }, [targetKey, racks, grid, look.partitions]);
  const lights = useMemo(() => layoutCeilingLights(target), [targetKey]);
  const floor = useMemo(() => buildFloor(config.dimensions, TILE.concrete), [dimKey]);
  const floorMarks = useMemo(() => buildFloorMarkings(layoutFloorMarkings(target, racks.racks)), [targetKey, racks]);
  const shafts = useMemo(() => buildLightShafts(layoutLightShafts(config, SUN_DIR)), [roofKey]);
  const pools = useMemo(() => buildLightPools(lights, 2.8), [lights]);
  const rooftop = useMemo(() => layoutRoofUnits(config, layoutSkylights(config)), [roofKey]);
  /* eslint-enable react-hooks/exhaustive-deps */

  // Prvky z katalogu se po výběru objeví plynule (vyrostou), ne naskočí. Vybavení čeká na dokončení úvodní stavby.
  const girderAppear = useAppear(look.structure.girder, build.beams);
  const heatingAppear = useAppear(look.heatingHall, build.furnish);
  const pumpAppear = useAppear(look.heatingOffice, build.furnish);
  const rackAppear = useAppear(String(look.partitions), build.furnish);
  const pvAppear = useAppear(String(look.pvShare));
  const partitionAppear = useAppear(String(look.partitions));
  useGrowY(pvRef, pvAppear);
  useGrowY(partitionRef, partitionAppear);

  useDispose(shell);
  useDispose(roof);
  useDispose(roofDetails);
  useDispose(office);
  useEffect(() => () => officeOutline?.dispose(), [officeOutline]);
  useDispose(floor);
  useDispose(pv);
  // These geometries are passed through mesh props, so R3F does not release replaced buffers.
  useEffect(() => () => floorMarks?.dispose(), [floorMarks]);
  useEffect(() => () => shafts?.dispose(), [shafts]);
  useEffect(() => () => pools?.dispose(), [pools]);
  useEffect(() => () => partitionGeo?.dispose(), [partitionGeo]);

  const columns = useMemo<InstanceItem[]>(
    () => grid.xs.flatMap((x) => grid.zs.filter((z) => pointInFootprint(target.dimensions, x, z)).map((z) => ({ x, z, y: target.dimensions.clearHeightM / 2, sx: look.structure.columnSize, sy: target.dimensions.clearHeightM, sz: look.structure.columnSize }))),
    [grid, target.dimensions.clearHeightM, look.structure.columnSize],
  );
  const corbels = useMemo<InstanceItem[]>(
    () => grid.xs.flatMap((x) => grid.zs.filter((z) => pointInFootprint(target.dimensions, x, z)).map((z) => ({ x, z, y: target.dimensions.clearHeightM - 0.55, sx: 0.95, sy: 0.5, sz: 0.8 }))),
    [grid, target.dimensions.clearHeightM],
  );

  useConstructionReveal(floorRef, () => build.state.current.floor, -dims.lengthM / 2 - 3, dims.lengthM / 2 + 3);
  // Rovina řezu: bod před čelní stěnou (z větší než W/2 − tloušťka) se nevykreslí. Mimo řez leží daleko za scénou.
  const sectionPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, -1), 1e5), []);
  useLayoutEffect(() => {
    sectionPlane.constant = section ? dims.widthM / 2 - G.wallThicknessM - 0.05 : 1e5;
    invalidateRoof();
  }, [section, dims.widthM, sectionPlane, invalidateRoof]);
  useConstructionReveal(wallsRef, () => build.state.current.walls, -dims.lengthM / 2 - 3, dims.lengthM / 2 + 3, "x", sectionPlane);
  useConstructionReveal(roofRef, () => build.state.current.roofReveal, -dims.lengthM / 2 - 3, dims.lengthM / 2 + 3);
  useConstructionReveal(officeRef, () => build.state.current.officePop, -0.1, H + 0.5, "y");

  // Základ roste od středu, střecha dosedá shora, vestavba "vyroste" po výšce.
  useFrame((_, delta) => {
    const st = build.state.current;
    if (roofRef.current) {
      const targetY = st.roofDrop + (roofExploded ? 8 : 0);
      roofRef.current.position.y = build.reducedMotion || Math.abs(roofRef.current.position.y - targetY) < 0.01 ? targetY : THREE.MathUtils.damp(roofRef.current.position.y, targetY, 7, Math.min(delta, 0.05));
      if (roofRef.current.position.y !== targetY) invalidateRoof();
    }
  });

  const pick = (section: SectionId) => (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return; // tah ovladače kamery není kliknutí
    e.stopPropagation();
    onPick(section);
  };
  const hover = (on: boolean) => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    gl.domElement.style.cursor = on ? "pointer" : "";
  };

  const dockHi = highlight === "docks";
  const driveHi = highlight === "driveIns";


  return (
    <group>
      {/* podlaha haly: leštěný drátkobeton s polem 6 × 6 m (při stavbě roste od středu) */}
      <group ref={floorRef}>
      <mesh geometry={floor.slab} receiveShadow>
        <meshStandardMaterial color="#b9bcc0" roughness={0.9} />
      </mesh>
      <mesh geometry={floor.surface} receiveShadow>
        <DampedStd map={look.floor.jointless ? undefined : textures.concrete} color={look.floor.tint} roughness={look.floor.roughness} metalness={0.05} />
      </mesh>
      {floorMarks && (
        <mesh geometry={floorMarks} receiveShadow>
          <meshStandardMaterial color="#d9b93b" roughness={0.55} />
        </mesh>
      )}
      </group>

      <LightPools geometry={pools} night={night} sensors={look.lighting === "sensors"} gate={build.furnish} />

      <group ref={wallsRef}>
      {/* fasády s reálnými otvory a reliéfem panelů */}
      <mesh geometry={shell.walls} castShadow receiveShadow onClick={pick("dimensions")}>
        <DampedStd map={textures.facadeMap} normalMap={textures.facadeNormal} normalScale={new THREE.Vector2(0.45, 0.45)} color={look.claddingColor} roughness={0.62} metalness={0.18} />
      </mesh>
      {shell.plinth && (
        <mesh geometry={shell.plinth} receiveShadow>
          <meshStandardMaterial color="#454c56" roughness={0.85} />
        </mesh>
      )}
      {shell.band && (
        <mesh geometry={shell.band}>
          <meshStandardMaterial color={NAVY} roughness={0.4} metalness={0.5} />
        </mesh>
      )}
      {shell.pipes && (
        <mesh geometry={shell.pipes}>
          <meshStandardMaterial color="#8d949d" roughness={0.4} metalness={0.8} />
        </mesh>
      )}
      <HallSignage config={config} />
      <BuildingDetails config={config} night={night} />
      {placeOpenings(config).filter((opening) => opening.kind === "dock" || opening.kind === "driveIn").map((opening) => (
        <OpeningAssembly key={opening.id} config={config} opening={opening} build={build} look={look} night={night} numbers={textures.numbers} highlighted={opening.kind === "dock" ? dockHi : driveHi} onPick={pick("openings")} />
      ))}
      {shell.glass && (
        <mesh geometry={shell.glass} onClick={pick("office")} onPointerOver={hover(true)} onPointerOut={hover(false)}>
          <DampedStd
            color={night ? "#e8c88c" : look.window.glassTint}
            emissive={night ? "#ffb347" : "#000000"}
            emissiveIntensity={night ? 1.6 : 0}
            roughness={0.05}
            metalness={night ? 0.15 : 0.65}
          />
        </mesh>
      )}
      {shell.frames && (
        <mesh geometry={shell.frames}>
          <DampedStd color={look.window.frameColor} roughness={0.5} metalness={0.7} />
        </mesh>
      )}
      <group ref={partitionRef}>
        {partitionGeo && (
          <mesh geometry={partitionGeo} castShadow receiveShadow>
            <meshStandardMaterial color="#e9ecef" roughness={0.85} />
          </mesh>
        )}
      </group>
      <mesh geometry={roof.coping}>
        <meshStandardMaterial color={NAVY} roughness={0.4} metalness={0.5} />
      </mesh>
      </group>

      {/* střecha: fólie se švy, obrubník, kopule světlíků, VZT jednotky */}
      <group ref={roofRef}>
        {/* Keep the assembly mounted: inspecting partitions must not destroy/recompile all roof materials. */}
        <group visible={!roofHidden}>
          {/* Střecha záměrně nevrhá stín dovnitř: interiér a pohled do vestavby zůstanou osvětlené (ilustrativní osvětlení). */}
          <mesh geometry={roof.slab} receiveShadow>
            <DampedStd color={look.roof.undersideColor} roughness={look.roof.timber ? 0.7 : 0.9} />
          </mesh>
          <mesh geometry={roof.surface} receiveShadow onClick={pick("roof")} onPointerOver={hover(true)} onPointerOut={hover(false)}>
            <DampedStd map={textures.membrane} color={look.roof.membraneTint} roughness={0.88} />
          </mesh>
          {roofDetails.curbs && (
            <mesh geometry={roofDetails.curbs} castShadow>
              <meshStandardMaterial color="#dfe3e7" roughness={0.7} />
            </mesh>
          )}
          {roofDetails.domes && (
            <mesh geometry={roofDetails.domes}>
              <DampedStd
                color={night ? "#ffe0a8" : look.skylight.tint}
                emissive={night ? "#ffb347" : "#000000"}
                emissiveIntensity={night ? 0.8 : 0}
                transparent
                opacity={look.skylight.opacity}
                roughness={0.1}
                metalness={0.35}
              />
            </mesh>
          )}
          {roofDetails.units && (
            <mesh geometry={roofDetails.units} castShadow>
              <meshStandardMaterial color="#8f98a3" roughness={0.6} metalness={0.5} />
            </mesh>
          )}
          {roofDetails.louvres && (
            <mesh geometry={roofDetails.louvres}>
              <meshStandardMaterial color="#4a525b" roughness={0.55} metalness={0.5} />
            </mesh>
          )}
          {roofDetails.ducts && (
            <mesh geometry={roofDetails.ducts} castShadow>
              <meshStandardMaterial color="#a7afb8" roughness={0.45} metalness={0.7} />
            </mesh>
          )}
          {roofDetails.fans && (
            <mesh geometry={roofDetails.fans}>
              <meshStandardMaterial color="#2b3138" roughness={0.5} metalness={0.7} />
            </mesh>
          )}
          <LightShafts geometry={shafts} night={night} gate={build.furnish} />
          <Instanced items={lights as InstanceItem[]} reveal={build.furnish} color={look.lighting === "sensors" ? "#e6f3ff" : "#f4f6f8"} emissive={look.lighting === "sensors" ? "#dff1ff" : "#ffffff"} emissiveIntensity={(night ? 2.2 : 0.9) * (look.lighting === "sensors" ? 0.7 : 1)}>
            <boxGeometry args={[1, 1, 1]} />
          </Instanced>
          {/* nosníky konstrukce a závěsné vytápění haly (v interiéru); fotovoltaika na střeše */}
          <Instanced items={heating} reveal={heatingAppear} metalness={0.5} roughness={0.5}>
            <boxGeometry args={[1, 1, 1]} />
          </Instanced>
          <group ref={pvRef} position-y={dims.clearHeightM + 1.0}>
            {pv.panels && (
              <mesh geometry={pv.panels} castShadow>
                <meshStandardMaterial map={textures.pvCell} color="#ffffff" roughness={0.3} metalness={0.4} />
              </mesh>
            )}
            {pv.bases && (
              <mesh geometry={pv.bases}>
                <meshStandardMaterial color="#8d949d" roughness={0.6} metalness={0.6} />
              </mesh>
            )}
          </group>
          <RoofFans units={rooftop} topY={dims.clearHeightM + 1.0} live={live} />
        </group>
      </group>

      {/* interiér: sloupy s konzolami, regály s paletami (ilustrační), administrativní vestavba */}
      <Instanced items={girders} reveal={girderAppear} assembly metalness={look.structure.girder === "steel" ? 0.7 : 0.1} roughness={look.structure.girder === "glulam" ? 0.7 : 0.6} castShadow>
        <boxGeometry args={[1, 1, 1]} />
      </Instanced>
      <Instanced items={columns} reveal={build.columns} assembly color="#aeb5bf" roughness={0.85} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
      </Instanced>
      <Instanced items={heatPumps} reveal={pumpAppear} color="#d9dde2" metalness={0.4} roughness={0.5} castShadow>
        <boxGeometry args={[1, 1, 1]} />
      </Instanced>
      <Instanced items={corbels} reveal={build.columns} assembly color="#aeb5bf" roughness={0.85} castShadow>
        <boxGeometry args={[1, 1, 1]} />
      </Instanced>
      <Instanced items={rackParts.uprights} reveal={rackAppear} stagger={0.8} metalness={0.4} roughness={0.5}>
        <boxGeometry args={[1, 1, 1]} />
      </Instanced>
      <Instanced items={rackParts.beams} reveal={rackAppear} stagger={0.8} metalness={0.3} roughness={0.5}>
        <boxGeometry args={[1, 1, 1]} />
      </Instanced>
      <Instanced items={rackParts.pallets} reveal={rackAppear} stagger={0.8} roughness={0.9}>
        <boxGeometry args={[1, 1, 1]} />
      </Instanced>
      <Robots robots={robots} live={indoorLive} gate={rackAppear} />
      <Instanced items={rackParts.goods} reveal={rackAppear} stagger={0.8} roughness={0.8}>
        <boxGeometry args={[1, 1, 1]} />
      </Instanced>
      {office && (
        <group ref={officeRef} onClick={pick("office")} onPointerOver={hover(true)} onPointerOut={hover(false)}>
          <mesh geometry={office.slabs} castShadow receiveShadow>
            <meshStandardMaterial color="#cdd1d7" roughness={0.8} />
          </mesh>
          <mesh geometry={office.ceiling} visible={!roofHidden && !section} castShadow receiveShadow>
            <meshStandardMaterial color="#cdd1d7" roughness={0.8} />
          </mesh>
          {office.walls && (
            <mesh geometry={office.walls}>
              <meshStandardMaterial color="#cfe3f2" transparent opacity={0.36} roughness={0.08} metalness={0.4} />
            </mesh>
          )}
          <OfficeFurniture config={config} reveal={build.furnish} />
          {office.partitions && (
            <mesh geometry={office.partitions} castShadow>
              <meshStandardMaterial color="#f3f5f7" roughness={0.8} />
            </mesh>
          )}
        </group>
      )}
      {highlight === "office" && officeBox && officeOutline && (
        <group>
          <mesh position={[(officeBox.x0 + officeBox.x1) / 2, officeBox.heightM / 2, (officeBox.z0 + officeBox.z1) / 2]}>
            <boxGeometry args={[officeBox.widthM + 0.2, officeBox.heightM + 0.2, officeBox.depthM + 0.2]} />
            <meshBasicMaterial color={SKY} transparent opacity={0.2} depthWrite={false} />
          </mesh>
          <lineSegments geometry={officeOutline} renderOrder={5}>
            <lineBasicMaterial color={SKY} depthTest={false} />
          </lineSegments>
        </group>
      )}
      <HeightMarker visible={highlight === "dimensions"} height={H} dims={dims} />
    </group>
  );
}

/** Svislá lišta u rohu při zvýraznění sekce rozměrů: ukazuje celkovou výšku. */
function HeightMarker({ visible, height, dims }: { visible: boolean; height: number; dims: HallConfig["dimensions"] }) {
  if (!visible) return null;
  return (
    <mesh position={[dims.lengthM / 2 + 0.6, height / 2, dims.widthM / 2 + 0.6]}>
      <boxGeometry args={[0.35, height, 0.35]} />
      <meshBasicMaterial color={SKY} transparent opacity={0.85} />
    </mesh>
  );
}

/** Newly selected assemblies settle into the facade without deforming their sections. */
function OpeningAssembly({ config, opening, build, look, night, numbers, highlighted, onPick }: { config: HallConfig; numbers: THREE.Texture; build: BuildAnim; opening: PlacedOpening; look: SceneLook; night: boolean; highlighted: boolean; onPick: (e: ThreeEvent<MouseEvent>) => void }) {
  const world = useTrafficWorld();
  const ref = useRef<THREE.Group>(null);
  const progress = useRef(0);
  const shutter = useRef<THREE.Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  const reduced = useRef(typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const signature = JSON.stringify([config.dimensions, opening, look.dock.house]);
  const geometry = useMemo(() => buildOpeningDetails(config.dimensions, opening, look.dock.house), [signature]);
  useDispose(geometry);
  useFrame((_, delta) => {
    if (!ref.current) return;
    progress.current = reduced.current ? 1 : Math.min(1, progress.current + Math.min(delta, 0.05) / 0.3);
    ref.current.position.y = 0.6 * Math.pow(1 - progress.current, 3);
    if (opening.kind === "driveIn" && shutter.current) {
      const open = Number(opening.id.split("-").at(-1)) <= 3 ? gateCycle(world?.time(`gate-${opening.id}`) ?? build.operationTime.current, Number(opening.id.split("-").at(-1)) - 1).open : 0;
      shutter.current.scale.y = Math.max(0.001, 1 - open);
      shutter.current.position.y = (opening.sillM + opening.heightM) * open;
      shutter.current.visible = open < 0.998;
    }
    if (progress.current < 1) invalidate();
  });
  const doorColor = opening.kind === "dock" ? look.dock.doorColor : look.driveIn.doorColor;
  const colors: Record<string, string> = { dockDoors: doorColor, driveInDoors: doorColor, doorGlass: "#26343a", shelters: "#2a2d32", bumpers: "#303738", lamps: "#e6e9e3", bollards: "#a9ad94", frames: look.window.frameColor };
  return <group ref={ref} onClick={onPick}>
    {Object.entries(geometry).map(([key, geo]) => geo && !(key === "doorGlass" && opening.kind === "driveIn") && <group key={key} ref={key === "driveInDoors" ? shutter : undefined}><mesh geometry={geo} castShadow={key !== "plates"} receiveShadow>
      {key === "plates" ? <meshStandardMaterial map={numbers} roughness={0.6} metalness={0.1} /> : <meshStandardMaterial color={highlighted ? SKY : colors[key] ?? "#a8b0ac"} roughness={0.55} metalness={0.2} emissive={key === "lamps" && night ? "#ffe5bb" : "#000000"} emissiveIntensity={night ? 1 : 0} />}
    </mesh></group>)}
  </group>;
}
