import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/** Animation only. Put `root` beneath your own physics/player group. */
export class WhiskerCat {
  static async load(url, { onStateChange } = {}) {
    const gltf = await new GLTFLoader().loadAsync(url);
    return new WhiskerCat(gltf, onStateChange);
  }
  constructor(gltf, onStateChange) {
    this.root = gltf.scene;
    this.root.name = 'WhiskerCat';
    this.mixer = new THREE.AnimationMixer(this.root);
    this.clips = gltf.animations;
    this.actions = new Map(this.clips.map(clip => [clip.name, this.mixer.clipAction(clip)]));
    this.onStateChange = onStateChange;
    this.state = null;
    this.root.traverse(object => {
      if (object.isMesh) { object.castShadow = true; object.receiveShadow = false; }
      if (object.isSkinnedMesh) object.frustumCulled = false;
    });
    this._finished = ({ action }) => {
      if (this.actions.get(this.state) !== action) return;
      if (this.state === 'jump') this.setState('fall', { fade: 0.12 });
      else if (this.state === 'land') this.setState('idle', { fade: 0.16 });
    };
    this.mixer.addEventListener('finished', this._finished);
    this.setState('idle', { fade: 0 });
  }
  setState(state, { fade = 0.16, restart = false } = {}) {
    const next = this.actions.get(state);
    if (!next) throw new RangeError(`Unknown cat animation: ${state}`);
    if (state === this.state && !restart) return;
    const previous = this.actions.get(this.state);
    // Retire every fading action as well as the most recent one. Rapid input
    // cannot leave older clips contributing to the pose indefinitely.
    this.actions.forEach(action => { if (action !== next) action.fadeOut(fade); });
    next.reset();
    next.setLoop(['jump', 'land'].includes(state) ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = ['jump', 'land'].includes(state);
    next.enabled = true;
    next.setEffectiveTimeScale(1);
    next.setEffectiveWeight(1);
    next.play();
    if (fade > 0 && previous) next.fadeIn(fade);
    this.state = state;
    this.onStateChange?.(state);
  }
  update(deltaSeconds) {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) return;
    this.mixer.update(deltaSeconds);
  }
  dispose() {
    this.mixer.removeEventListener('finished', this._finished);
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
    const geometries = new Set(), materials = new Set(), textures = new Set();
    this.root.traverse(o => {
      if (!o.isMesh) return;
      geometries.add(o.geometry);
      for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
        materials.add(m);
        Object.values(m).forEach(value => { if (value?.isTexture) textures.add(value); });
      }
    });
    textures.forEach(x => x.dispose()); materials.forEach(x => x.dispose()); geometries.forEach(x => x.dispose());
    this.root.removeFromParent();
  }
}
