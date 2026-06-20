struct SpriteInstance {
  x: f32,
  y: f32,
  w: f32,
  h: f32,
  opacity: f32,
  flipX: f32,
  _pad0: f32,
  _pad1: f32,
}

@group(1) @binding(0) var<storage, read> instances: array<SpriteInstance>;

@group(2) @binding(0) var sprite_tex:  texture_2d<f32>;
@group(2) @binding(1) var sprite_samp: sampler;

struct SpriteVert {
  @builtin(position) position: vec4<f32>,
  @location(0) uv:      vec2<f32>,
  @location(1) opacity: f32,
}

@vertex
fn vs_sprite(
  @builtin(vertex_index)   vi: u32,
  @builtin(instance_index) ii: u32,
) -> SpriteVert {
  // Two-triangle quad, center at origin in [-0.5, 0.5]
  var corners = array<vec2<f32>, 6>(
    vec2<f32>(-0.5, -0.5), vec2<f32>(0.5, -0.5), vec2<f32>(-0.5, 0.5),
    vec2<f32>(-0.5,  0.5), vec2<f32>(0.5, -0.5), vec2<f32>(0.5,  0.5),
  );
  // UV must match screen orientation: the top-of-screen corner (lp.y = -0.5,
  // smaller pixel Y) samples the top of the texture (uv.y = 0), otherwise the
  // sprite renders upside down.
  var uvCoords = array<vec2<f32>, 6>(
    vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 0.0), vec2<f32>(0.0, 1.0),
    vec2<f32>(0.0, 1.0), vec2<f32>(1.0, 0.0), vec2<f32>(1.0, 1.0),
  );

  let inst = instances[ii];
  let lp   = corners[vi];

  // Pixel-space position (inst.x/y is sprite center)
  let px = inst.x + lp.x * inst.w;
  let py = inst.y + lp.y * inst.h;

  // NDC: x left=-1 right=+1, y bottom=-1 top=+1
  let nx = (px / globals.screenWidth)  * 2.0 - 1.0;
  let ny = 1.0 - (py / globals.screenHeight) * 2.0;

  var uv = uvCoords[vi];
  if (inst.flipX > 0.5) { uv.x = 1.0 - uv.x; }

  var out: SpriteVert;
  out.position = vec4<f32>(nx, ny, 0.0, 1.0);
  out.uv       = uv;
  out.opacity  = inst.opacity;
  return out;
}

@fragment
fn fs_sprite(in: SpriteVert) -> @location(0) vec4<f32> {
  let col = textureSample(sprite_tex, sprite_samp, in.uv);
  if (col.a < 0.01) { discard; }
  return vec4<f32>(col.rgb, col.a * in.opacity);
}
