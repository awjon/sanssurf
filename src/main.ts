import { App } from './app';

async function main(): Promise<void> {
  if (!navigator.gpu) {
    document.getElementById('no-webgpu')?.classList.add('visible');
    return;
  }

  try {
    const app = new App();
    await app.run();
  } catch (err) {
    console.error('Failed to start SansSurf:', err);
    const el = document.getElementById('no-webgpu');
    if (el) {
      el.classList.add('visible');
      el.innerHTML = `<p>&#128566; Failed to start</p><p style="color:#fff;font-size:0.8em">${err}</p>`;
    }
  }
}

main();
