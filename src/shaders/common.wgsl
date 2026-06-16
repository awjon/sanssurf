struct Globals {
  time: f32,
  deltaTime: f32,
  screenWidth: f32,
  screenHeight: f32,
  cameraScroll: f32,
  waveXOffset: f32,
  waveState: f32,
  shakeX: f32,
}

@group(0) @binding(0) var<uniform> globals: Globals;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
}

@vertex
fn vs_fullscreen(@builtin(vertex_index) vi: u32) -> VertexOutput {
  var pos = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>( 1.0, -1.0), vec2<f32>(-1.0,  1.0),
    vec2<f32>(-1.0,  1.0), vec2<f32>( 1.0, -1.0), vec2<f32>( 1.0,  1.0)
  );
  var uvs = array<vec2<f32>, 6>(
    vec2<f32>(0.0, 1.0), vec2<f32>(1.0, 1.0), vec2<f32>(0.0, 0.0),
    vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 1.0), vec2<f32>(1.0, 0.0)
  );
  var out: VertexOutput;
  out.position = vec4<f32>(pos[vi], 0.0, 1.0);
  out.uv = uvs[vi];
  return out;
}
