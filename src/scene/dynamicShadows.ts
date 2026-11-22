import type { Object3D, Quaternion, Vector3 } from "three";

interface ShadowPose {
  visible: boolean;
  position: Vector3;
  quaternion: Quaternion;
  scale: Vector3;
  moving: boolean;
  frame: number;
}

/** Refresh a cached shadow map for moving casters, without rendering it at the scene's full frame rate. */
export class DynamicShadowRefresh {
  private readonly poses = new Map<Object3D, ShadowPose>();
  private frame = 0;
  private pending = false;
  private lastRefresh = -Infinity;

  constructor(private readonly interval = 1 / 12) {}

  update(objects: readonly (Object3D | null)[], time: number): boolean {
    const frame = ++this.frame;
    let immediate = false;
    for (const object of objects) {
      if (!object) continue;
      let previous = this.poses.get(object);
      if (!previous) {
        previous = {
          visible: object.visible,
          position: object.position.clone(),
          quaternion: object.quaternion.clone(),
          scale: object.scale.clone(),
          moving: false,
          frame,
        };
        this.poses.set(object, previous);
        if (object.visible) immediate = true;
      }
      const moved = object.visible && previous.visible && (
        !previous.position.equals(object.position) ||
        !previous.quaternion.equals(object.quaternion) ||
        !previous.scale.equals(object.scale)
      );
      // Appearance, disappearance and the final pose must never wait for another traffic frame.
      if (previous.visible !== object.visible || (previous.moving && !moved)) immediate = true;
      if (moved) this.pending = true;
      previous.visible = object.visible;
      previous.position.copy(object.position);
      previous.quaternion.copy(object.quaternion);
      previous.scale.copy(object.scale);
      previous.moving = moved;
      previous.frame = frame;
    }
    for (const [object, previous] of this.poses) {
      if (previous.frame === frame) continue;
      if (previous.visible) immediate = true;
      this.poses.delete(object);
    }
    if (!immediate && (!this.pending || time - this.lastRefresh < this.interval)) return false;
    this.pending = false;
    this.lastRefresh = time;
    return true;
  }
}
