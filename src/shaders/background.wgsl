fn perspLaneLine(uv: vec2<f32>, botX: f32) -> f32 {
  let vx = 0.500;
  let vy = 0.130;
  if (uv.y <= vy) { return 0.0; }
  let lineX = vx + (botX - vx) * (uv.y - vy) / (1.0 - vy);
  let lineWidth = 0.0025 + 0.003 * ((uv.y - vy) / (1.0 - vy));
  return smoothstep(lineWidth, lineWidth * 0.3, abs(uv.x - lineX));
}

fn palmTree(uv: vec2<f32>, tx: f32) -> f32 {
  let trunkTop = 0.52;
  let trunkBot = 0.76;
  let trunkW   = 0.006;
  let lean = 0.012 * (1.0 - (uv.y - trunkTop) / (trunkBot - trunkTop));
  let cx = tx + lean;
  let inTrunk = f32(abs(uv.x - cx) < trunkW && uv.y > trunkTop && uv.y < trunkBot);
  let fc = vec2<f32>(tx + lean, trunkTop - 0.005);
  let fd0 = (uv - fc) / vec2<f32>(0.042, 0.050);
  let fd1 = (uv - (fc + vec2<f32>(-0.022, -0.018))) / vec2<f32>(0.028, 0.038);
  let fd2 = (uv - (fc + vec2<f32>( 0.022, -0.018))) / vec2<f32>(0.028, 0.038);
  let inFrond = f32(dot(fd0,fd0) < 1.0 || dot(fd1,fd1) < 1.0 || dot(fd2,fd2) < 1.0);
  return max(inTrunk, inFrond);
}

@fragment
fn fs_background(in: VertexOutput) -> @location(0) vec4<f32> {
  let uv = in.uv;
  let t = globals.time;
  let scroll = globals.cameraScroll;

  // ---- Sky (seen through barrel mouth at top) ----
  let skyDeep    = vec3<f32>(0.05, 0.14, 0.48);
  let skyBright  = vec3<f32>(0.48, 0.74, 0.97);
  var sky = mix(skyDeep, skyBright, smoothstep(0.0, 0.60, uv.y));

  // Sun (slightly off-center, visible through barrel opening)
  let sunPos  = vec2<f32>(0.55, 0.055);
  let sunDist = length(uv - sunPos);
  sky += vec3<f32>(1.0, 0.96, 0.78) * smoothstep(0.055, 0.018, sunDist);
  sky += vec3<f32>(1.0, 0.82, 0.48) * 0.22 * smoothstep(0.42, 0.0, sunDist);

  // ---- Ocean water (mid-bottom) ----
  let oceanT   = smoothstep(0.30, 0.72, uv.y);
  let oceanCol = mix(vec3<f32>(0.03, 0.18, 0.44), vec3<f32>(0.08, 0.38, 0.60),
                     smoothstep(0.30, 0.75, uv.y));

  // Perspective lane lines converging to vanishing point
  var lanes = 0.0;
  lanes = max(lanes, perspLaneLine(uv, 0.12));
  lanes = max(lanes, perspLaneLine(uv, 0.30));
  lanes = max(lanes, perspLaneLine(uv, 0.50));
  lanes = max(lanes, perspLaneLine(uv, 0.70));
  lanes = max(lanes, perspLaneLine(uv, 0.88));
  let laneVis = lanes * smoothstep(0.48, 0.65, uv.y) * 0.28;

  // Rushing foam streaks (moving toward camera = downward)
  let fv = fract(uv.y * 2.8 - scroll * 0.0065 - t * 0.22);
  let fh = fract(uv.x * 14.0 + sin(uv.x * 9.0 + t * 0.4) * 0.12);
  let foamNoise = fract(sin(fh * 43.7 + fv * 29.3) * 5291.4);
  let foamMask  = step(0.62, foamNoise) * smoothstep(0.42, 0.80, uv.y) * 0.50;

  // Shallow water near camera
  let shallowT   = smoothstep(0.68, 0.90, uv.y);
  let shallowCol = vec3<f32>(0.35, 0.72, 0.82);

  // ---- Beach edges (left/right sides only, lower half) ----
  let edgeL   = 1.0 - smoothstep(0.0, 0.20, uv.x);
  let edgeR   = 1.0 - smoothstep(0.80, 1.0, uv.x);
  let edgeMask = clamp(edgeL + edgeR, 0.0, 1.0);
  let beachY  = smoothstep(0.60, 0.78, uv.y);
  let sand    = mix(vec3<f32>(0.62, 0.54, 0.38), vec3<f32>(0.87, 0.78, 0.58),
                    smoothstep(0.70, 0.92, uv.y));

  // ---- Palm trees at side edges ----
  let sc = scroll * 0.003;
  var palms = 0.0;
  palms = max(palms, palmTree(uv, 0.05 + sc * 0.02));
  palms = max(palms, palmTree(uv, 0.13 + sc * 0.02));
  palms = max(palms, palmTree(uv, 0.87 - sc * 0.02));
  palms = max(palms, palmTree(uv, 0.95 - sc * 0.02));
  // Restrict palms to side edge regions
  palms *= clamp(edgeL * 2.5 + edgeR * 2.5, 0.0, 1.0);
  let palmCol = vec3<f32>(0.06, 0.13, 0.03);

  // ---- Compose ----
  var color = sky;
  color = mix(color, oceanCol, oceanT);
  color += vec3<f32>(0.75, 0.85, 0.92) * (foamMask + laneVis);
  color = mix(color, shallowCol, shallowT * (1.0 - edgeMask));
  color = mix(color, sand, beachY * edgeMask);
  color = mix(color, palmCol, palms * 0.95);

  return vec4<f32>(color, 1.0);
}
