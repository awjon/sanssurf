@group(1) @binding(0) var bg_tex:  texture_2d<f32>;
@group(1) @binding(1) var bg_samp: sampler;

@fragment
fn fs_bg_photo(in: VertexOutput) -> @location(0) vec4<f32> {
  let dim   = vec2<f32>(textureDimensions(bg_tex, 0));
  let scrAR = globals.screenWidth / globals.screenHeight;
  let texAR = dim.x / dim.y;
  var uv    = in.uv;
  // Cover-fit: crop the narrow dimension so the image fills the screen without bars
  if (scrAR > texAR) {
    // Screen is wider than image: crop top/bottom
    uv.y = (uv.y - 0.5) * (texAR / scrAR) + 0.5;
  } else {
    // Screen is taller than image (portrait): crop left/right
    uv.x = (uv.x - 0.5) * (scrAR / texAR) + 0.5;
  }
  uv = clamp(uv, vec2<f32>(0.0), vec2<f32>(1.0));
  return textureSample(bg_tex, bg_samp, uv);
}
