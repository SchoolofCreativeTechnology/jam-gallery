import * as THREE from 'three';
import * as T from './tuning.js';
import {
  setBackground,
  createMountainPlane,
  createMistLayer,
  createTownSilhouettes,
  createChineseRoofMesh,
} from './environment.js';

function rand(min, max) {
  return min + Math.random() * (max - min);
}

// Maximum vertical rise reachable for a given horizontal gap,
// assuming launch speed v and gravity g. Derived from projectile motion.
function maxDyForGap(dx) {
  const v = T.jumpSpeed;
  const g = T.gravity;
  const v2 = v * v;
  return 0.5 * (v2 / g) * (1 - (g * g * dx * dx) / (v2 * v2));
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.roofs = [];
    this.vases = [];
    this.killPlaneY = T.killPlaneY;
    this.cameraTarget = new THREE.Vector3(0, 0, 0);

    setBackground(scene);

    this.mountainPlane = createMountainPlane(scene);
    this.mistLayers = [
      createMistLayer(scene, -7, 0.22, 1.1),
      createMistLayer(scene, -13, 0.32, 1.6),
    ];
    this.townSilhouettes = createTownSilhouettes(scene);

    this.floodMesh = new THREE.Mesh(
      new THREE.BoxGeometry(60, 1, 30),
      new THREE.MeshStandardMaterial({ color: T.floodColor, roughness: 0.3 })
    );
    this.floodMesh.position.set(0, T.floodStartHeight - 0.5, 0);
    this.floodMesh.receiveShadow = true;
    this.scene.add(this.floodMesh);

    this.reset();
  }

  reset() {
    for (const roof of this.roofs) {
      this.scene.remove(roof.mesh);
      this.disposeMesh(roof.mesh);
    }
    this.roofs.length = 0;

    for (const vase of this.vases) {
      this.scene.remove(vase.mesh);
      vase.mesh.geometry.dispose();
      vase.mesh.material.dispose();
    }
    this.vases.length = 0;

    this.addRoof(0, 0, T.startRoofWidth, 0);
    this.startRoof = this.roofs[0];

    this.floodY = T.floodStartHeight;
    this.floodRiseSpeed = T.floodRiseSpeed;
    this.maxHeightReached = 0;
    this.speedStepsApplied = 0;
    this.cameraTarget.set(0, 0, 0);
  }

  disposeMesh(mesh) {
    mesh.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          for (const m of child.material) m.dispose();
        } else {
          child.material.dispose();
        }
      }
    });
  }

  addRoof(centerX, topY, width, slopeAngle = 0) {
    const mesh = createChineseRoofMesh(centerX, topY, width, slopeAngle);
    this.scene.add(mesh);

    const tan = Math.tan(slopeAngle);
    const roof = {
      mesh,
      x: centerX,
      top: topY,
      width,
      left: centerX - width / 2,
      right: centerX + width / 2,
      slopeAngle,
      tan,
    };
    this.roofs.push(roof);
    return roof;
  }

  surfaceYAt(roof, x) {
    return roof.top + roof.tan * (x - roof.x);
  }

  generateNextRoof() {
    const current = this.roofs[this.roofs.length - 1];
    const dir = Math.random() < 0.5 ? -1 : 1;

    const steps = Math.floor(this.maxHeightReached / T.heightStepM);
    const gapBonus = steps * T.gapGrowth;
    const varianceBonus = steps * T.heightVarianceGrowth;

    // Roof width: mostly mid-sized, with the odd narrow ledge and the odd wide
    // rest platform. Chances and the min/max span come from tuning.js.
    const span = T.roofWidthMax - T.roofWidthMin;
    const widthRoll = Math.random();
    let width;
    if (widthRoll < T.narrowRoofChance) {
      // Extra-narrow ledge.
      width = rand(T.roofWidthMin, T.roofWidthMin + span * 0.16);
    } else if (widthRoll < T.narrowRoofChance + T.restPlatformChance) {
      // Extra-wide resting platform.
      width = rand(T.roofWidthMax - span * 0.2, T.roofWidthMax);
    } else {
      // Everyday roof, keeping the extreme ends for the two special cases.
      width = rand(T.roofWidthMin + span * 0.2, T.roofWidthMax - span * 0.22);
    }

    // Horizontal gap: varied, never longer than the jump arc can reach, and
    // never so short that the two roof silhouettes crowd each other.
    let dx = rand(T.gapMin + gapBonus, T.gapMax + gapBonus);
    dx = Math.min(dx, T.gapHardMax);
    dx = Math.max(dx, (current.width + width) / 2 + T.roofClearance);

    let dy = rand(-(T.heightVariance + varianceBonus) * 0.3, T.heightVariance + varianceBonus);

    // Clamp the height difference so the jump can always reach it.
    const maxDy = maxDyForGap(dx) * 0.9;
    if (dy > maxDy) dy = Math.max(0, maxDy - 0.2);

    const newTop = current.top + dy;
    const newCenterX = current.x + dir * dx;

    const slopeRoll = Math.random();
    const slopeThreshold = Math.min(0.9, T.slopeChance + steps * T.slopeChanceGrowth);
    const slopeAngle = slopeRoll < slopeThreshold
      ? (Math.random() < 0.5 ? 1 : -1) * THREE.MathUtils.degToRad(T.slopeAngleDeg)
      : 0;

    const roof = this.addRoof(newCenterX, newTop, width, slopeAngle);
    this.maybePlaceVase(roof);
  }

  maybePlaceVase(roof) {
    if (Math.random() >= T.vaseChance) return;
    if (Math.abs(roof.slopeAngle) > 0.001) return; // vases only on flat roofs for M2

    const geometry = new THREE.BoxGeometry(T.vaseSize, T.vaseSize * 1.3, T.vaseSize);
    const material = new THREE.MeshStandardMaterial({ color: T.vaseColor });
    const mesh = new THREE.Mesh(geometry, material);

    const x = roof.x + rand(-roof.width * 0.25, roof.width * 0.25);
    const y = roof.top + (T.vaseSize * 1.3) / 2;
    mesh.position.set(x, y, 0);
    mesh.castShadow = true;
    this.scene.add(mesh);

    this.vases.push({ mesh, x, y, width: T.vaseSize, height: T.vaseSize * 1.3, points: T.vasePoints });
  }

  update(playerPos, dt) {
    // Keep a chain of roofs ahead of the player.
    let highest = this.roofs[this.roofs.length - 1].top;
    while (highest < playerPos.y + T.generateAhead) {
      this.generateNextRoof();
      highest = this.roofs[this.roofs.length - 1].top;
    }

    // Discard roofs that have fallen far below the camera.
    while (this.roofs.length > 1 && this.roofs[0].top < playerPos.y - 13) {
      const old = this.roofs.shift();
      this.scene.remove(old.mesh);
      this.disposeMesh(old.mesh);
    }

    // Discard vases below the camera.
    for (let i = this.vases.length - 1; i >= 0; i--) {
      if (this.vases[i].y < playerPos.y - 20) {
        const old = this.vases.splice(i, 1)[0];
        this.scene.remove(old.mesh);
        old.mesh.geometry.dispose();
        old.mesh.material.dispose();
      }
    }

    // Update flood rise speed based on new max height reached.
    if (playerPos.y > this.maxHeightReached) {
      this.maxHeightReached = playerPos.y;
      const steps = Math.floor(this.maxHeightReached / T.heightStepM);
      while (this.speedStepsApplied < steps) {
        this.speedStepsApplied++;
        this.floodRiseSpeed = Math.min(T.floodSpeedMax, this.floodRiseSpeed + T.floodSpeedStep);
      }
    }

    this.floodY += this.floodRiseSpeed * dt;
    this.floodMesh.position.y = this.floodY - 0.5;

    // Camera target follows the player upward and horizontally.
    const targetX = playerPos.x;
    const targetY = playerPos.y + T.cameraYOffset;
    const k = 1 - Math.exp(-T.cameraFollowSpeed * dt);
    this.cameraTarget.x += (targetX - this.cameraTarget.x) * k;
    this.cameraTarget.y += (targetY - this.cameraTarget.y) * k;

    // Parallax the painted background so it always frames the action.
    const camY = this.cameraTarget.y;
    if (this.mountainPlane) {
      this.mountainPlane.position.y = camY;
    }
    if (this.mistLayers) {
      this.mistLayers[0].position.y = camY + Math.sin(playerPos.y * 0.03) * 0.5;
      this.mistLayers[1].position.y = camY + Math.cos(playerPos.y * 0.025) * 0.7;
    }
    if (this.townSilhouettes) {
      for (const town of this.townSilhouettes) {
        town.mesh.position.y = town.baseY + camY * 0.12;
      }
    }
  }

  getCameraTarget() {
    return this.cameraTarget;
  }

  getFloodY() {
    return this.floodY;
  }

  // Make sure generated roofs reach at least targetY, so a jump preview never
  // misses a roof that hasn't been created yet.
  ensureRoofsTo(targetY) {
    let highest = this.roofs[this.roofs.length - 1].top;
    while (highest < targetY) {
      this.generateNextRoof();
      highest = this.roofs[this.roofs.length - 1].top;
    }
  }

  // Find the first roof surface the segment from prevPos to currentPos crosses
  // from above. Returns { roof, x, y } of the exact landing point, or null.
  findLanding(prevPos, currentPos) {
    const eps = 0.05;
    let bestT = Infinity;
    let best = null;

    for (const roof of this.roofs) {
      // Quick X overlap test between the movement segment and the roof.
      const segMinX = Math.min(prevPos.x, currentPos.x) - eps;
      const segMaxX = Math.max(prevPos.x, currentPos.x) + eps;
      if (segMaxX < roof.left || segMinX > roof.right) continue;

      // Roof surface line: y = roof.top + roof.tan * (x - roof.x).
      // Solve for t where the segment crosses that line.
      const dx = currentPos.x - prevPos.x;
      const dy = currentPos.y - prevPos.y;
      const denom = dy - roof.tan * dx;
      if (Math.abs(denom) < 0.0001) continue;

      const t = (roof.top - roof.tan * roof.x + roof.tan * prevPos.x - prevPos.y) / denom;
      if (t < -eps || t > 1 + eps) continue;

      const x = prevPos.x + t * dx;
      if (x < roof.left - eps || x > roof.right + eps) continue;

      // Must be a downward crossing (from above the surface to at/below it).
      const surfacePrev = this.surfaceYAt(roof, prevPos.x);
      if (prevPos.y <= surfacePrev) continue;

      if (t < bestT) {
        bestT = t;
        best = { roof, x, y: this.surfaceYAt(roof, x) };
      }
    }

    return best;
  }

  // Return a vase overlapping the player position, or null.
  testVaseCollision(playerPos, halfW, halfH) {
    for (let i = 0; i < this.vases.length; i++) {
      const v = this.vases[i];
      if (
        playerPos.x + halfW > v.x - v.width / 2 &&
        playerPos.x - halfW < v.x + v.width / 2 &&
        playerPos.y + halfH > v.y - v.height / 2 &&
        playerPos.y - halfH < v.y + v.height / 2
      ) {
        return i;
      }
    }
    return -1;
  }

  removeVase(index) {
    const vase = this.vases.splice(index, 1)[0];
    this.scene.remove(vase.mesh);
    vase.mesh.geometry.dispose();
    vase.mesh.material.dispose();
    return vase.points;
  }
}
