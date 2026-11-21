// Excerpt from Tilt Racer (source is private; available on request).
// Copyright (c) 2026 Moses Enyinnaya. All rights reserved. Not licensed for reuse.

/**
 * Turns any car GLB into something the race can drive: one set of geometry shared by every car of
 * that model, in game units with the nose along +x, merged by material (a few draw calls instead of
 * forty), with each wheel re-centred on its own axle so it can spin and steer. Paint and tail-light
 * materials are found by name and swapped per player (colour, damage soot, brake lights).
 */
function prepare(scene: THREE.Object3D, spec: CarModelSpec): CarTemplate {
  scene.updateMatrixWorld(true);
  // model frame → game frame: nose onto +x, metres → game units
  const toGame = new THREE.Matrix4().makeRotationY(spec.yaw)
    .premultiply(new THREE.Matrix4().makeScale(spec.scale, spec.scale, spec.scale));
  const axles: (THREE.Vector3 | null)[] = [null, null, null, null];
  const body: Placed[] = [], wheel: Placed[][] = [[], [], [], []], caliper: Placed[][] = [[], [], [], []];

  scene.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const toCar = toGame.clone().multiply(mesh.matrixWorld);
    const c = cornerOf(mesh); // wheel_FL / brake_RR … found by walking up the parents
    if (!c) { body.push({ mesh, matrix: toCar }); return; }
    if (c.kind === 'wheel' && !axles[c.i]) axles[c.i] = c.node.getWorldPosition(new THREE.Vector3()).applyMatrix4(toGame);
    (c.kind === 'wheel' ? wheel : caliper)[c.i].push({ mesh, matrix: toCar });
  });
  if (axles.some(a => !a)) throw new Error(`${spec.url}: needs four wheels named wheel_FL/FR/RL/RR`);

  const wheels = CORNERS.map((_, i) => {
    const pos = axles[i]!;
    const recentre = (list: Placed[]) => list.map(({ mesh, matrix }) =>
      ({ mesh, matrix: new THREE.Matrix4().makeTranslation(-pos.x, -pos.y, -pos.z).multiply(matrix) }));
    return { pos, parts: mergeByMaterial(recentre(wheel[i])), caliper: mergeByMaterial(recentre(caliper[i])) };
  });
  // the game's left wheels sit at −z: if the model is the other way round, swap the sides
  if (wheels[0].pos.z > wheels[1].pos.z) { [wheels[0], wheels[1]] = [wheels[1], wheels[0]]; [wheels[2], wheels[3]] = [wheels[3], wheels[2]]; }
  return { body: mergeByMaterial(body), wheels };
}

/** Compressed (meshopt) models store positions as small normalised integers: copy them to full
 *  precision before moving them into the car's frame, or the transform would round them. */
function toFloat(a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) {
  const out = new Float32Array(a.count * 3);
  for (let i = 0; i < a.count; i++) { out[i * 3] = a.getX(i); out[i * 3 + 1] = a.getY(i); out[i * 3 + 2] = a.getZ(i); }
  return new THREE.BufferAttribute(out, 3);
}
