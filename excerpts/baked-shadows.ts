// Excerpt from Tilt Racer (source is private; available on request).
// Copyright (c) 2026 Moses Enyinnaya. All rights reserved. Not licensed for reuse.

/**
 * Baked lighting for the circuit. Blender Cycles bakes soft sun shadows and contact occlusion from
 * every tree, barrier and building onto one texture over the whole track (R = ambient occlusion,
 * G = sun visibility). The road, kerbs, gravel and grass sample it by world position: direct sun is
 * dimmed by the baked shadow, sky light by the occlusion. Only cars still cast real-time shadows,
 * which is far cheaper than drawing 1,300 trees into a shadow map every frame.
 *
 * Patched into three.js's own lighting chunks, composing with any patch a material already has
 * (the grass shader), and skipped when the bake was made for a different layout (hash mismatch).
 */
export function applyBakedMask(material: THREE.Material, mask: BakedMask) {
  const prev = material.userData.bakePrev;
  const { minX, minZ, sizeX, sizeZ } = mask.meta;
  material.onBeforeCompile = (shader, renderer) => {
    prev?.call(material, shader, renderer);
    shader.uniforms.bakeMask = { value: mask.texture };
    shader.uniforms.bakeBounds = { value: new THREE.Vector4(minX, minZ, sizeX, sizeZ) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBakeWorld;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvBakeWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D bakeMask;\nuniform vec4 bakeBounds;\nvarying vec3 vBakeWorld;')
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>
        {
          vec2 bakeUv = (vBakeWorld.xz - bakeBounds.xy) / bakeBounds.zw;
          float inside = step(0.0, bakeUv.x) * step(bakeUv.x, 1.0) * step(0.0, bakeUv.y) * step(bakeUv.y, 1.0);
          vec4 bm = texture2D(bakeMask, bakeUv);
          float sun = mix(1.0, bm.g, inside), occl = mix(1.0, mix(1.0, bm.r, 0.85), inside);
          reflectedLight.directDiffuse *= sun;   reflectedLight.directSpecular *= sun;
          reflectedLight.indirectDiffuse *= occl; reflectedLight.indirectSpecular *= occl;
        }`);
  };
  // unique per variant: three.js would otherwise reuse a plain material's program for the grass
  const variant = 'baked-shadows:' + (prev ? prev.name || prev.toString().length : 'plain');
  material.customProgramCacheKey = () => variant;
  material.needsUpdate = true;
}
