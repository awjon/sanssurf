fn waveBottomEdge(x: f32, t: f32) -> f32 {
  return 0.60
    + 0.055 * sin(x * 3.8 + t * 1.2)
    + 0.022 * sin(x * 9.1 + t * 2.1 + 1.3)
    + 0.008 * sin(x * 18.5 + t * 3.7)
    + globals.waveXOffset;
}

@fragment
fn fs_wave(in: VertexOutput) -> @location(0) vec4<f32> {
  let uv    = in.uv;
  let t     = globals.time;
  let scroll = globals.cameraScroll;

  let bottomEdge = waveBottomEdge(uv.x, t);
  let FRINGE = 0.045;

  // Nothing below fringe
  if (uv.y > bottomEdge + FRINGE) {
    return vec4<f32>(0.0);
  }

  // Spray fringe below bottom edge
  if (uv.y > bottomEdge) {
    let ft = (uv.y - bottomEdge) / FRINGE;
    let sn = fract(sin(uv.x * 58.3 + uv.y * 73.1 + t * 3.8) * 5193.7);
    let fadeEdge = smoothstep(0.0, 0.04, uv.x) * smoothstep(1.0, 0.96, uv.x);
    let sprayA = (1.0 - ft) * step(0.48, sn) * 0.65 * fadeEdge;
    return vec4<f32>(0.88, 0.94, 1.0, sprayA);
  }

  // Depth within wave: 0=top, 1=bottom edge
  let depth = clamp(uv.y / max(bottomEdge, 0.01), 0.0, 1.0);

  // ---- Barrel opening ellipse at top center ----
  let bCenter = vec2<f32>(0.5, 0.058);
  let bRadii  = vec2<f32>(0.30, 0.068);
  let bCoord  = (uv - bCenter) / bRadii;
  let bDist   = dot(bCoord, bCoord);
  let inBarrel   = bDist < 1.0;
  let barrelGlow = smoothstep(2.0, 0.8, bDist) * f32(!inBarrel);

  // Sky visible through barrel
  let skyDeep   = vec3<f32>(0.08, 0.22, 0.58);
  let skyBright = vec3<f32>(0.52, 0.78, 0.98);
  var barrSky   = mix(skyDeep, skyBright, smoothstep(0.10, 0.0, uv.y));
  let sunD = length(uv - vec2<f32>(0.53, 0.038));
  barrSky += vec3<f32>(1.0, 0.95, 0.76) * smoothstep(0.040, 0.006, sunD);

  // ---- Wave body: dark ceiling ----
  let ceilDeep = vec3<f32>(0.01, 0.06, 0.18);
  let ceilMid  = vec3<f32>(0.03, 0.16, 0.34);
  var waveCol  = mix(ceilDeep, ceilMid, depth);

  // Glass side walls (green-teal, brightens toward edges and lower half)
  let sideX    = abs(uv.x - 0.5) * 2.0; // 0=center 1=edges
  let sideWall = smoothstep(0.48, 0.88, sideX) * smoothstep(0.18, 0.65, depth);
  let faceGreen = vec3<f32>(0.04, 0.52, 0.30);
  let faceTeal  = vec3<f32>(0.05, 0.38, 0.52);
  waveCol = mix(waveCol, mix(faceGreen, faceTeal, depth), sideWall * 0.72);

  // Shimmer lines on ceiling
  let shimmer = pow(max(0.0, sin(uv.x * 26.0 + t * 6.5 + depth * 5.5 + uv.y * 9.0)), 10.0)
              * 0.17 * (1.0 - depth * 0.55);
  waveCol += shimmer;

  // Foam streaks rushing downward (toward camera)
  let fv = fract(uv.y * 2.5 - scroll * 0.005 - t * 0.30);
  let fh = fract(uv.x * 11.0 + sin(uv.x * 7.5 + t * 0.6) * 0.14);
  let foamNoise = fract(sin(fh * 47.3 + fv * 31.2) * 5291.4);
  let foamVis   = step(0.72, foamNoise)
                * smoothstep(0.14, 0.62, depth)
                * (1.0 - sideWall * 0.45)
                * 0.50;
  waveCol = mix(waveCol, vec3<f32>(0.88, 0.93, 1.0), foamVis);

  // Foam churning along bottom edge
  let edgeFoam = smoothstep(0.10, 0.0, bottomEdge - uv.y)
               * step(0.52, fract(uv.x * 9.2 + t * 1.6)) * 0.55;
  waveCol = mix(waveCol, vec3<f32>(0.92, 0.97, 1.0), edgeFoam);

  // Barrel glow halo around opening
  waveCol += barrelGlow * vec3<f32>(0.15, 0.38, 0.60) * 0.45;

  // ---- Alpha ----
  var alpha = 0.96;
  alpha *= smoothstep(0.0, 0.020, uv.y);
  alpha *= smoothstep(0.0, 0.035, uv.x) * smoothstep(1.0, 0.965, uv.x);
  // Slight transparency at bottom glass edge
  alpha *= smoothstep(bottomEdge, bottomEdge - 0.05, uv.y) * 0.20 + 0.80;

  // Barrel opening: nearly transparent so background sky shows through
  if (inBarrel) {
    return vec4<f32>(barrSky, alpha * 0.10);
  }

  return vec4<f32>(waveCol, alpha);
}
