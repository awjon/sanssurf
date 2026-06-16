fn waveRightEdge(v: f32, t: f32) -> f32 {
  // v = 0 top, 1 bottom
  let base  = 0.355;
  let w1    = 0.032 * sin(v * 3.8 + t * 1.3);
  let w2    = 0.014 * sin(v * 8.7 + t * 2.2 + 1.1);
  let w3    = 0.006 * sin(v * 18.0 + t * 3.5 + 0.4);
  // curl: top of wave overhangs to the right
  let curl  = 0.042 * smoothstep(0.18, 0.0, v) * (0.6 + 0.4 * sin(t * 0.7));
  return base + w1 + w2 + w3 + curl;
}

@fragment
fn fs_wave(in: VertexOutput) -> @location(0) vec4<f32> {
  let uv = in.uv; // x:0=left 1=right, y:0=top 1=bottom
  let t = globals.time;

  let rightEdge = waveRightEdge(uv.y, t) + globals.waveXOffset;

  if (uv.x > rightEdge) {
    return vec4<f32>(0.0);
  }

  // Distance from face (right edge)
  let faceDist = rightEdge - uv.x;
  let faceProx = clamp(faceDist / 0.08, 0.0, 1.0); // 0=face 1=deep interior

  let v = uv.y;

  // ---- Face color (glass water) ----
  let faceTop  = vec3<f32>(0.10, 0.62, 0.38);  // bright green at lip
  let faceMid  = vec3<f32>(0.03, 0.38, 0.58);  // teal
  let faceBot  = vec3<f32>(0.01, 0.18, 0.36);  // deep blue
  let faceCol  = mix(faceTop, mix(faceMid, faceBot, smoothstep(0.25, 0.80, v)), smoothstep(0.05, 0.30, v));

  // ---- Interior color ----
  let intCol = mix(vec3<f32>(0.02, 0.12, 0.30), vec3<f32>(0.04, 0.22, 0.42), v);

  // Blend face → interior
  var bodyCol = mix(faceCol, intCol, faceProx);

  // ---- Shimmer on face ----
  let shimmer = pow(max(0.0, sin(uv.x * 28.0 - t * 7.0 + v * 6.0 + 0.5)), 10.0) * 0.18
              * (1.0 - faceProx) * smoothstep(0.08, 0.5, v);
  bodyCol += shimmer;

  // ---- Foam at top ----
  let foamZone = smoothstep(0.20, 0.0, v);
  let fn1 = fract(sin(uv.x * 43.7 + t * 3.1) * 2357.8 + sin(v * 31.2 + t * 1.9) * 5171.3);
  let fn2 = fract(sin(uv.x * 97.1 + t * 2.4 + 0.7) * 3211.5 + sin(v * 71.5 - t * 2.1) * 8931.2);
  let foamNoise = (fn1 + fn2) * 0.5;
  let foamAlpha = foamZone * step(0.38, foamNoise);
  let foamCol   = vec3<f32>(0.94, 0.97, 1.00);

  // Foam spray streaks slightly past wave face
  let streakDist = faceDist + 0.02;
  let streak = foamZone * 0.35 * step(0.62, fn2) * smoothstep(0.0, 0.04, streakDist) * smoothstep(0.07, 0.03, streakDist);
  if (uv.x > rightEdge + 0.005) {
    return vec4<f32>(foamCol, streak);
  }

  bodyCol = mix(bodyCol, foamCol, foamAlpha);

  // ---- Trough darkening ----
  let troughDark = smoothstep(0.72, 1.0, v) * 0.55;
  bodyCol *= (1.0 - troughDark);

  // ---- Turbulence in back of wave (white water) ----
  let backWater = smoothstep(0.06, 0.0, uv.x + globals.waveXOffset);
  let ww = fract(sin(uv.x * 53.1 - t * 2.8) * 7412.3 + sin(v * 47.3 + t * 1.6) * 3891.5);
  let wwAlpha = backWater * step(0.35, ww) * 0.65;
  bodyCol = mix(bodyCol, vec3<f32>(0.88, 0.92, 0.97), wwAlpha);

  // ---- Alpha ----
  // Slightly transparent on face for glass look, opaque interior
  var alpha = mix(0.80, 0.97, faceProx);
  // Fade top edge smoothly (the very tip)
  alpha *= smoothstep(0.0, 0.025, v);
  // Fade bottom of wave
  alpha *= smoothstep(1.0, 0.88, v);

  return vec4<f32>(bodyCol, alpha);
}
