import * as THREE from 'three';
import * as T from './tuning.js';
import { createCatSprite } from './cat.js';

export const STATES = {
  IDLE: 'idle',
  AIMING: 'aiming',
  JUMPING: 'jumping',
  FALLING: 'falling',
  LANDED: 'landed',
  DEAD: 'dead',
};

// Simulate one trajectory arc for the preview. It uses the same physics as the
// real jump, so the marker never lies.
function simulateFlight(startPos, angle, world) {
  const points = [];
  const v = new THREE.Vector2(
    T.jumpSpeed * Math.cos(angle),
    T.jumpSpeed * Math.sin(angle)
  );
  const pos = new THREE.Vector2(startPos.x, startPos.y);
  const g = T.gravity;
  const dt = T.trajectoryDt;

  points.push({ x: pos.x, y: pos.y, t: 0 });

  for (let i = 0; i < T.trajectorySteps; i++) {
    const prev = pos.clone();
    pos.x += v.x * dt;
    pos.y += v.y * dt;
    v.y -= g * dt;
    const t = (i + 1) * dt;
    points.push({ x: pos.x, y: pos.y, t });

    const landing = world.findLanding(prev, pos);
    if (landing) {
      return { points, landing };
    }

    if (pos.y < -200) break; // don't simulate forever
  }

  return { points, landing: null };
}

export class Player {
  constructor(scene, whiskerCat = null) {
    this.scene = scene;
    this.halfH = T.playerHeight / 2;
    this.whiskerCat = whiskerCat;
    this.animState = 'idle';
    this.faceDir = 1; // +1 = right, -1 = left

    // Visual root follows physics but does not affect it.
    this.visualRoot = new THREE.Group();
    this.visualRoot.position.z = 0.2;
    this.scene.add(this.visualRoot);

    if (this.whiskerCat) {
      // Custom 3D calico cat from Codex.
      this.modelScale = 0.78;
      this.whiskerCat.root.scale.setScalar(this.modelScale);
      // The model's feet sit at local y=0 (bbox min.y is 0 at any scale), so an
      // offset of -halfH drops them exactly onto the collider's bottom face,
      // which is the roof surface. Scaling about the root origin keeps that true.
      this.whiskerCat.root.position.y = -this.halfH;
      // Model forward is -Z; rotate so forward aligns with +X gameplay direction.
      this.whiskerCat.root.rotation.y = -Math.PI / 2;
      this.visualRoot.add(this.whiskerCat.root);
      this.mesh = this.whiskerCat.root; // keep reference for cleanup
    } else {
      // Watercolor canvas sprite fallback.
      this.mesh = createCatSprite();
      this.visualRoot.add(this.mesh);
    }

    // Invisible collision box: physics and trajectory use this, never the visual.
    this.collider = new THREE.Mesh(
      new THREE.BoxGeometry(T.playerWidth, T.playerHeight, T.playerDepth),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.scene.add(this.collider);

    // Dotted trajectory preview
    this.arcGeometry = new THREE.BufferGeometry();
    this.arcPoints = new THREE.Points(
      this.arcGeometry,
      new THREE.PointsMaterial({ color: T.arcColor, size: 0.12 })
    );
    this.arcPoints.frustumCulled = false;
    this.scene.add(this.arcPoints);

    // Landing marker
    this.marker = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.1, 0.4),
      new THREE.MeshBasicMaterial({ color: T.markerColor })
    );
    this.scene.add(this.marker);

    // Cosmetic sprite animation state (only used when no GLB).
    this.visual = {
      sx: 1,
      sy: 1,
      rz: 0,
      pushOff: 0,
      landingSquash: 0,
      prevState: STATES.IDLE,
    };

    this.reset(0, 0);
  }

  reset(x, y) {
    this.position = new THREE.Vector3(x, y, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.state = STATES.IDLE;
    this.currentRoof = null;
    this.aimTime = 0;
    this.aimAngle = Math.PI / 2;
    this.faceDir = 1;
    this.visual.sx = 1;
    this.visual.sy = 1;
    this.visual.rz = 0;
    this.visual.pushOff = 0;
    this.visual.landingSquash = 0;
    this.hideAim();
    this.setAnim('idle');
    this.updateMesh();
  }

  hideAim() {
    this.arcPoints.visible = false;
    this.marker.visible = false;
  }

  showAim(points, landing) {
    this.arcPoints.visible = true;
    this.marker.visible = true;

    const arr = new Float32Array(points.length * 3);
    for (let i = 0; i < points.length; i++) {
      arr[i * 3] = points[i].x;
      arr[i * 3 + 1] = points[i].y;
      arr[i * 3 + 2] = 0;
    }
    this.arcGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(arr, 3)
    );

    const mark = landing || points[points.length - 1];
    this.marker.position.set(mark.x, mark.y, 0);
  }

  setAnim(name) {
    if (this.whiskerCat && this.animState !== name) {
      try {
        this.whiskerCat.setState(name);
        this.animState = name;
      } catch (e) {
        // Ignore unknown states; fallback stays on current clip.
      }
    }
  }

  startAim() {
    if (this.state === STATES.IDLE || this.state === STATES.LANDED) {
      this.state = STATES.AIMING;
      this.setAnim('aim');
    }
  }

  releaseAim() {
    if (this.state !== STATES.AIMING) return;
    this.jump();
  }

  jump() {
    this.state = STATES.JUMPING;
    this.velocity.set(
      T.jumpSpeed * Math.cos(this.aimAngle),
      T.jumpSpeed * Math.sin(this.aimAngle),
      0
    );

    // Face the direction of the jump.
    if (Math.abs(this.velocity.x) > 0.01) {
      this.faceDir = Math.sign(this.velocity.x) || 1;
    }

    // Make sure the landing roof has been generated before we predict the path.
    if (this.world) {
      const peakY = this.position.y + (T.jumpSpeed * T.jumpSpeed) / (2 * T.gravity);
      this.world.ensureRoofsTo(peakY + 5);
    }

    this.hideAim();
    this.currentRoof = null;

    this.setAnim('jump');

    // Cosmetic push-off for sprite fallback.
    this.visual.pushOff = 1;
  }

  slideOnRoof(dt) {
    if (!this.currentRoof) return;
    const roof = this.currentRoof;
    const tan = roof.tan;
    if (Math.abs(tan) < 0.001) return;

    // Slide toward the lower edge. Positive slope rises to the right,
    // so the lower edge is on the left (negative x).
    const dir = tan > 0 ? -1 : 1;
    const dx = dir * T.slideSpeed * dt;
    this.position.x += dx;
    this.position.y = this.world.surfaceYAt(roof, this.position.x) + this.halfH;

    if (this.position.x < roof.left || this.position.x > roof.right) {
      this.state = STATES.FALLING;
      this.currentRoof = null;
      this.velocity.set(dir * T.slideSpeed, -Math.abs(tan) * T.slideSpeed, 0);
      this.setAnim('fall');
    }
  }

  // Move one physics step and land if the movement segment crosses a roof surface.
  applyPhysicsAndLand(dt, world) {
    const prev = this.position.clone();

    this.velocity.y -= T.gravity * dt;
    this.position.addScaledVector(this.velocity, dt);

    const landing = world.findLanding(prev, this.position);
    if (landing) {
      this.land(landing.roof, landing.x);
      return true;
    }
    return false;
  }

  update(dt, world) {
    this.world = world;
    this.aimTime += dt;

    if (this.state === STATES.AIMING) {
      this.slideOnRoof(dt);
      const range = THREE.MathUtils.degToRad(T.aimRangeDeg);
      this.aimAngle = Math.PI / 2 + range * Math.sin(this.aimTime * T.aimSweepSpeed);

      const result = simulateFlight(this.position, this.aimAngle, world);
      this.showAim(result.points, result.landing);
    } else if (this.state === STATES.JUMPING || this.state === STATES.FALLING) {
      this.applyPhysicsAndLand(dt, world);
    } else if (this.state === STATES.LANDED) {
      this.slideOnRoof(dt);
    }

    if (this.whiskerCat) {
      this.whiskerCat.update(dt);
    } else {
      this.updateAnimation(dt);
    }
    this.updateMesh();
    this.visual.prevState = this.state;
  }

  land(roof, x) {
    this.state = STATES.LANDED;
    this.velocity.set(0, 0, 0);
    this.position.x = x;
    this.position.y = this.world.surfaceYAt(roof, x) + this.halfH;
    this.currentRoof = roof;

    this.setAnim('land');

    // Cosmetic landing squash for sprite fallback.
    this.visual.landingSquash = 1;
  }

  updateAnimation(dt) {
    const v = this.visual;
    const state = this.state;

    // Base targets.
    let targetSX = 1;
    let targetSY = 1;
    let targetRZ = 0;

    if (state === STATES.AIMING) {
      // Crouch and gentle hip/tail wiggle.
      targetSX = 1.12;
      targetSY = 0.78;
      targetRZ = 0.07 * Math.sin(this.aimTime * 9);
    } else if (state === STATES.JUMPING || state === STATES.FALLING) {
      // Stretch a little while airborne, settle toward normal.
      targetSX = 0.96;
      targetSY = 1.08;
      targetRZ = THREE.MathUtils.clamp(-this.velocity.x * 0.015, -0.12, 0.12);
    } else {
      // Idle / landed.
      targetSX = 1;
      targetSY = 1;
      targetRZ = 0;
    }

    // Push-off on release: quick vertical stretch that decays.
    if (v.pushOff > 0) {
      const push = v.pushOff * 0.35;
      targetSX -= push * 0.35;
      targetSY += push;
      v.pushOff = Math.max(0, v.pushOff - dt * 6);
    }

    // Landing squash: brief vertical compression that decays.
    if (v.landingSquash > 0) {
      const squash = v.landingSquash * 0.45;
      targetSX += squash * 0.45;
      targetSY -= squash;
      v.landingSquash = Math.max(0, v.landingSquash - dt * 8);
    }

    // Smoothly interpolate to target (spring-ish lerp).
    const k = 1 - Math.exp(-18 * dt);
    v.sx += (targetSX - v.sx) * k;
    v.sy += (targetSY - v.sy) * k;
    v.rz += (targetRZ - v.rz) * k;
  }

  updateMesh() {
    // The visual root follows physics but never changes it.
    this.visualRoot.position.set(this.position.x, this.position.y, 0.2);

    if (this.whiskerCat) {
      // Face left or right depending on last jump direction.
      const targetRot = this.faceDir > 0 ? -Math.PI / 2 : Math.PI / 2;
      this.visualRoot.rotation.y += (targetRot - this.visualRoot.rotation.y) * 0.25;
    } else {
      // Sprite fallback transform.
      this.mesh.position.set(0, 0, 0);
      this.mesh.scale.set(
        T.playerWidth * 2.2 * this.visual.sx,
        T.playerHeight * 2.2 * this.visual.sy,
        1
      );
      this.mesh.material.rotation = this.visual.rz;
    }

    // Collider follows position but stays unscaled for accurate collision.
    this.collider.position.copy(this.position);
  }
}
