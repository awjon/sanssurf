fn palmTree(uv: vec2<f32>, tx: f32) -> f32 {
  let trunkTop = 0.52;
  let trunkBot = 0.76;
  let trunkW   = 0.006;
  // slight lean
  let lean = 0.015 * (1.0 - (uv.y - trunkTop) / (trunkBot - trunkTop));
  let cx = tx + lean;
  let inTrunk = f32(abs(uv.x - cx) < trunkW && uv.y > trunkTop && uv.y < trunkBot);

  // frond cluster: 3 overlapping ellipses
  let fc = vec2<f32>(tx + lean, trunkTop - 0.005);
  let fd0 = (uv - fc) / vec2<f32>(0.045, 0.055);
  let fd1 = (uv - (fc + vec2<f32>(-0.025, -0.02))) / vec2<f32>(0.03, 0.04);
  let fd2 = (uv - (fc + vec2<f32>( 0.025, -0.02))) / vec2<f32>(0.03, 0.04);
  let inFrond = f32(dot(fd0,fd0) < 1.0 || dot(fd1,fd1) < 1.0 || dot(fd2,fd2) < 1.0);

  return max(inTrunk, inFrond);
}

@fragment
fn fs_background(in: VertexOutput) -> @location(0) vec4<f32> {
  let uv = in.uv; // x:0=left 1=right, y:0=top 1=bottom
  let t = globals.time;
  let scroll = globals.cameraScroll;

  // ---- Sky ----
  let skyTop    = vec3<f32>(0.04, 0.12, 0.42);
  let skyMid    = vec3<f32>(0.18, 0.42, 0.78);
  let skyHorizon = vec3<f32>(0.68, 0.82, 0.96);
  var sky = mix(skyTop, skyMid, smoothstep(0.0, 0.35, uv.y));
  sky     = mix(sky, skyHorizon, smoothstep(0.35, 0.55, uv.y));

  // Sun
  let sunPos  = vec2<f32>(0.72, 0.12);
  let sunDist = length(uv - sunPos);
  let sunDisc = vec3<f32>(1.0, 0.95, 0.75) * smoothstep(0.045, 0.03, sunDist);
  let sunGlow = vec3<f32>(1.0, 0.80, 0.45) * 0.28 * smoothstep(0.35, 0.0, sunDist);
  sky += sunDisc + sunGlow;

  // ---- Ocean band ----
  let oceanT  = smoothstep(0.50, 0.54, uv.y) * (1.0 - smoothstep(0.68, 0.72, uv.y));
  let oceanCol = mix(vec3<f32>(0.04, 0.22, 0.44), vec3<f32>(0.08, 0.32, 0.52),
                     smoothstep(0.50, 0.68, uv.y));
  // scrolling sparkle on ocean
  let sparkUV = vec2<f32>(fract(uv.x * 4.0 + scroll * 0.007 + t * 0.05), uv.y);
  let sparkle = 0.06 * pow(max(0.0, sin(sparkUV.x * 55.0 + t * 4.0)), 12.0);
  let ocean = oceanCol + sparkle;

  // ---- Beach ----
  let beachT   = smoothstep(0.70, 0.76, uv.y);
  let sandDark = vec3<f32>(0.64, 0.56, 0.40);
  let sandMid  = vec3<f32>(0.84, 0.76, 0.55);
  let sandBright = vec3<f32>(0.92, 0.86, 0.68);
  let sand = mix(sandDark, mix(sandMid, sandBright, smoothstep(0.78, 0.95, uv.y)), smoothstep(0.70, 0.80, uv.y));

  // Wave-wash at waterline
  let washLine = 0.725 + 0.008 * sin(uv.x * 18.0 + scroll * 0.032 - t * 1.2);
  let wash = 0.25 * smoothstep(washLine + 0.012, washLine, uv.y) * (1.0 - smoothstep(washLine - 0.008, washLine - 0.022, uv.y));

  // ---- Palm trees (right portion of screen only) ----
  let sc = fract(scroll * 0.0085);
  let palmMask = step(0.38, uv.x); // only right of wave

  let tx0 = fract(0.48 - sc);
  let tx1 = fract(0.63 - sc);
  let tx2 = fract(0.73 - sc);
  let tx3 = fract(0.83 - sc);
  let tx4 = fract(0.93 - sc);
  let tx5 = fract(0.58 - sc + 0.1);

  var palms = 0.0;
  if (tx0 > 0.36) { palms = max(palms, palmTree(uv, tx0)); }
  if (tx1 > 0.36) { palms = max(palms, palmTree(uv, tx1)); }
  if (tx2 > 0.36) { palms = max(palms, palmTree(uv, tx2)); }
  if (tx3 > 0.36) { palms = max(palms, palmTree(uv, tx3)); }
  if (tx4 > 0.36) { palms = max(palms, palmTree(uv, tx4)); }
  if (tx5 > 0.36) { palms = max(palms, palmTree(uv, tx5)); }
  palms *= palmMask;

  let palmCol = vec3<f32>(0.06, 0.14, 0.03);

  // ---- Compose ----
  var color = sky;
  color = mix(color, ocean, oceanT);
  color = mix(color, sand, beachT);
  color += wash;
  color = mix(color, palmCol, palms * 0.95);

  // Shadow on far left where wave lives
  let waveShadow = 0.45 * smoothstep(0.42, 0.0, uv.x);
  color *= (1.0 - waveShadow);

  return vec4<f32>(color, 1.0);
}
