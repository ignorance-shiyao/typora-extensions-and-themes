// iPic — `main`. Uploads images through iPic, the macOS image-hosting app,
// by running ipic.js with macOS's built-in osascript.

let script = null;

function toBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

async function runScript(payload) {
  script ??= new TextDecoder().decode(await typora.runtime.readAsset("ipic.js"));
  const child = await typora.process.spawn("osascript", ["-l", "JavaScript", "-e", script], { name: "ipic" });
  const decoder = new TextDecoder();
  let stdout = "";
  let stderr = "";
  child.onData((bytes, stream) => {
    if (stream === "stderr") stderr += decoder.decode(bytes, { stream: true });
    else stdout += decoder.decode(bytes, { stream: true });
  });
  const exited = new Promise((resolve) => child.onExit(resolve));
  const text = JSON.stringify(payload);
  for (let i = 0; i < text.length; i += 1 << 20) await child.write(text.slice(i, i + (1 << 20)));
  await child.end();
  const { code } = await exited;
  const lines = stdout
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  const fatal = lines.find((line) => line.fatal);
  if (fatal) throw new Error(fatal.fatal);
  if (code !== 0) throw new Error(`iPic upload failed: ${stderr.trim().split("\n").pop() || `osascript exited with ${code}`}`);
  return lines;
}

async function upload(images) {
  if (!images.length) return [];
  const results = await runScript(
    images.map((image) => ({ name: image.name, path: image.path ?? null, data: toBase64(image.bytes) })),
  );
  const urls = [];
  const failures = [];
  images.forEach((image, index) => {
    const result = results.find((line) => line.index === index);
    if (result?.ok) urls.push(result.url);
    else failures.push(`${image.name}: ${result?.error ?? "no answer from iPic"}`);
  });
  if (failures.length) throw new Error(`iPic couldn't upload ${failures.join("; ")}`);
  return urls;
}

export function activate(ctx) {
  ctx.subscriptions.push(typora.images.registerUploader("ipic", upload));
}
