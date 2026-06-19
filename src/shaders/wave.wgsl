fn waveTopEdge(x: f32, t: f32) -> f32 {
  // Center of wave crests slightly higher (barrel peak)
  let arch = -0.048 * (1.0 - (x * 2.0 - 1.0) * (x * 2.0 - 1.0));
  let w1   = 0.038 * sin(x * 3.2 + t * 1.4);
  let w2   = 0.016 * sin(x * 8.1 + t * 2.5 + 1.2);
  let w3   = 0.007 * sin(x * 17.0 + t * 3.9);
  return 0.62 + arch + w1 + w2 + w3 + globals.waveXOffset;
}

@fragment
fn fs_wave(in: VertexOutput) -> @location(0) vec4<f32> {
  let uv    = in.uv;
  let t     = globals.time;
  let scroll = globals.cameraScroll;

  let topEdge = waveTopEdge(uv.x, t);
  let FRINGE = 0.032;

  // Nothing above the spray fringe
  if (uv.y < topEdge - FRINGE) {
    return vec4<f32>(0.0);
  }

  // Spray / foam fringe just above crest
  if (uv.y < topEdge) {
    let ft = (topEdge - uv.y) / FRINGE;
    let sn = fract(sin(uv.x * 58.3 + uv.y * 73.1 + t * 3.8) * 5193.7);
    let fade = smoothstep(0.0, 0.04, uv.x) * smoothstep(1.0, 0.96, uv.x);
    let sprayA = (1.0 - ft) * step(0.44, sn) * 0.72 * fade;
    return vec4<f32>(0.94, 0.97, 1.0, sprayA);
  }

  // Within wave body: depth 0 = crest, 1 = bottom of screen
  let depth = clamp((uv.y - topEdge) / max(1.0 - topEdge, 0.01), 0.0, 1.0);

  // ---- Wave face color: bright green lip → teal → deep blue ----
  let faceTop = vec3<f32>(0.06, 0.68, 0.42);
  let faceMid = vec3<f32>(0.03, 0.44, 0.60);
  let faceBot = vec3<f32>(0.01, 0.14, 0.36);
  var col = mix(faceTop, faceMid, smoothstep(0.0, 0.35, depth));
  col = mix(col, faceBot, smoothstep(0.30, 0.90, depth));

  // Glassy barrel hollow at center-top (lit from inside)
  let cx = abs(uv.x - 0.5) * 2.0; // 0=center, 1=edges
  let barrelGlow = smoothstep(0.65, 0.0, cx) * smoothstep(0.22, 0.0, depth) * 0.48;
  col = mix(col, vec3<f32>(0.52, 0.88, 0.72), barrelGlow);

  // White foam crest at lip
  let crestFoam = smoothstep(0.16, 0.0, depth);
  col = mix(col, vec3<f32>(0.95, 0.98, 1.0), crestFoam);

  // Shimmer on face
  let shimmer = pow(max(0.0, sin(uv.x * 26.0 - t * 7.0 + depth * 5.0)), 10.0)
              * 0.17 * smoothstep(0.55, 0.0, depth);
  col += shimmer;

  // Rushing foam streaks (appear to flow up the face toward the lip)
  let fv = fract((1.0 - uv.y) * 2.8 - t * 0.30 + scroll * 0.004);
  let fh = fract(uv.x * 12.0 + sin(uv.x * 7.5 + t * 0.7) * 0.14);
  let foamNoise = fract(sin(fh * 47.3 + fv * 31.2) * 5291.4);
  let foamVis = step(0.72, foamNoise) * smoothstep(0.06, 0.65, depth) * 0.44;
  col = mix(col, vec3<f32>(0.90, 0.95, 1.0), foamVis);

  // Trough darkens toward base
  col *= 1.0 - smoothstep(0.70, 1.0, depth) * 0.55;

  // ---- Alpha ----
  var alpha = 0.97;
  alpha *= smoothstep(topEdge - 0.008, topEdge + 0.020, uv.y); // crisp top edge
  alpha *= smoothstep(1.0, 0.95, uv.y);                         // fade at bottom
  alpha *= smoothstep(0.0, 0.025, uv.x) * smoothstep(1.0, 0.975, uv.x); // sides

  return vec4<f32>(col, alpha);
}
