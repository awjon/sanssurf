fn perspLaneLine(uv: vec2<f32>, botX: f32) -> f32 {
  let vx = 0.500;
  let vy = 0.280; // vanishing point / horizon
  if (uv.y <= vy) { return 0.0; }
  let lineX = vx + (botX - vx) * (uv.y - vy) / (1.0 - vy);
  let lineWidth = 0.0018 + 0.0022 * ((uv.y - vy) / (1.0 - vy));
  return smoothstep(lineWidth, lineWidth * 0.3, abs(uv.x - lineX));
}

fn palmTree(uv: vec2<f32>, tx: f32) -> f32 {
  let trunkTop = 0.38;
  let trunkBot = 0.60;
  let trunkW   = 0.005;
  let lean = 0.010 * (1.0 - (uv.y - trunkTop) / (trunkBot - trunkTop));
  let cx = tx + lean;
  let inTrunk = f32(abs(uv.x - cx) < trunkW && uv.y > trunkTop && uv.y < trunkBot);
  let fc  = vec2<f32>(tx + lean, trunkTop - 0.004);
  let fd0 = (uv - fc) / vec2<f32>(0.036, 0.042);
  let fd1 = (uv - (fc + vec2<f32>(-0.018, -0.015))) / vec2<f32>(0.024, 0.032);
  let fd2 = (uv - (fc + vec2<f32>( 0.018, -0.015))) / vec2<f32>(0.024, 0.032);
  let inFrond = f32(dot(fd0,fd0) < 1.0 || dot(fd1,fd1) < 1.0 || dot(fd2,fd2) < 1.0);
  return max(inTrunk, inFrond);
}

@fragment
fn fs_background(in: VertexOutput) -> @location(0) vec4<f32> {
  let uv    = in.uv;
  let t     = globals.time;
  let scroll = globals.cameraScroll;

  // ---- Sky (top 28%) ----
  let skyDeep   = vec3<f32>(0.04, 0.12, 0.40);
  let skyBright = vec3<f32>(0.44, 0.70, 0.94);
  var sky = mix(skyDeep, skyBright, smoothstep(0.0, 0.28, uv.y));

  // Sun near the horizon
  let sunPos  = vec2<f32>(0.56, 0.25);
  let sunDist = length(uv - sunPos);
  sky += vec3<f32>(1.0, 0.96, 0.78) * smoothstep(0.050, 0.014, sunDist);
  sky += vec3<f32>(1.0, 0.82, 0.48) * 0.22 * smoothstep(0.40, 0.0, sunDist);

  // Horizon glow band
  let horizGlow = smoothstep(0.32, 0.26, uv.y) * smoothstep(0.22, 0.28, uv.y);
  sky = mix(sky, vec3<f32>(0.88, 0.94, 1.0), horizGlow * 0.32);

  // ---- Ocean surface (y 0.26 – 0.65, lower part hidden by wave shader) ----
  let oceanT   = smoothstep(0.24, 0.64, uv.y);
  let oceanCol = mix(vec3<f32>(0.04, 0.22, 0.52), vec3<f32>(0.06, 0.34, 0.58),
                     smoothstep(0.28, 0.64, uv.y));

  // Sparkle highlights on ocean surface
  let spark  = fract(sin(uv.x * 87.3 + uv.y * 61.5 + t * 2.1) * 5391.2);
  let sparkV = step(0.88, spark) * smoothstep(0.30, 0.58, uv.y) * 0.38;

  // Perspective lane lines converging to horizon VP
  var lanes = 0.0;
  lanes = max(lanes, perspLaneLine(uv, 0.12));
  lanes = max(lanes, perspLaneLine(uv, 0.30));
  lanes = max(lanes, perspLaneLine(uv, 0.50));
  lanes = max(lanes, perspLaneLine(uv, 0.70));
  lanes = max(lanes, perspLaneLine(uv, 0.88));
  let laneVis = lanes * smoothstep(0.32, 0.60, uv.y) * 0.20;

  // Rushing foam streaks toward camera
  let fv = fract(uv.y * 2.8 - scroll * 0.006 - t * 0.20);
  let fh = fract(uv.x * 14.0 + sin(uv.x * 9.0 + t * 0.4) * 0.12);
  let foamNoise = fract(sin(fh * 43.7 + fv * 29.3) * 5291.4);
  let foamMask  = step(0.64, foamNoise) * smoothstep(0.33, 0.60, uv.y) * 0.36;

  // ---- Beach strip at sides (between horizon and wave crest) ----
  let edgeL = 1.0 - smoothstep(0.0, 0.18, uv.x);
  let edgeR = 1.0 - smoothstep(0.82, 1.0, uv.x);
  let edgeMask = clamp(edgeL + edgeR, 0.0, 1.0);
  let beachY = smoothstep(0.44, 0.58, uv.y) * smoothstep(0.63, 0.56, uv.y);
  let sand   = mix(vec3<f32>(0.60, 0.52, 0.36), vec3<f32>(0.84, 0.75, 0.55),
                   smoothstep(0.45, 0.60, uv.y));

  // ---- Palm silhouettes (repositioned to mid-screen band) ----
  let sc = scroll * 0.003;
  var palms = 0.0;
  palms = max(palms, palmTree(uv, 0.05 + sc * 0.018));
  palms = max(palms, palmTree(uv, 0.12 + sc * 0.018));
  palms = max(palms, palmTree(uv, 0.88 - sc * 0.018));
  palms = max(palms, palmTree(uv, 0.95 - sc * 0.018));
  palms *= clamp(edgeL * 2.5 + edgeR * 2.5, 0.0, 1.0);
  let palmCol = vec3<f32>(0.05, 0.11, 0.02);

  // ---- Compose ----
  var color = sky;
  color = mix(color, oceanCol, oceanT);
  color += vec3<f32>(0.75, 0.85, 0.92) * (foamMask + laneVis + sparkV);
  color = mix(color, sand, beachY * edgeMask);
  color = mix(color, palmCol, palms * 0.95);

  return vec4<f32>(color, 1.0);
}
