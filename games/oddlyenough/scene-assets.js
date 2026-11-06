import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const cache = new Map();
const base = new URL('./assets/pawn-shop/', import.meta.url);
export const PAWN_ITEMS = ['01-camera','02-pocket-watch','03-guitar','04-porcelain-cat','05-gold-trophy','06-winged-snake','07-storm-globe','08-laugh-jar','09-door','10-alien-egg'];

// Templates share immutable geometry/textures. Each visit gets fresh object transforms.
// Failure is bounded and never prevents the functional fallback scene from playing.
export async function loadPawnModel(kind, name) {
  if (!['store','characters','items'].includes(kind) || !/^[a-z0-9-]+$/.test(name || '')) return null;
  const url = new URL(`${kind}/${name}.glb`, base).href;
  if (!cache.has(url)) {
    const pending = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`Asset HTTP ${response.status}`);
        const gltf = await loader.parseAsync(await response.arrayBuffer(), new URL('.', url).href);
        gltf.scene.traverse(node => {
          if (!node.isMesh) return;
          node.castShadow = true; node.receiveShadow = true;
          for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
            if (material.transparent) { material.depthWrite = false; node.castShadow = false; }
            if (material.map) { material.map.magFilter = THREE.NearestFilter; material.map.anisotropy = 4; }
          }
        });
        return gltf.scene;
      } catch {
        cache.delete(url);
        return null;
      } finally { clearTimeout(timer); }
    })();
    cache.set(url, pending);
  }
  const template = await cache.get(url);
  return template ? template.clone(true) : null;
}

// Preserve the model's proportions, center it horizontally, and seat it on a surface.
export function fitProp(model, longestSide = .52) {
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const scale = longestSide / Math.max(size.x, size.y, size.z, .001);
  const root = new THREE.Group();
  model.scale.multiplyScalar(scale);
  model.position.add(new THREE.Vector3(-center.x * scale, -bounds.min.y * scale, -center.z * scale));
  root.add(model);
  return root;
}
