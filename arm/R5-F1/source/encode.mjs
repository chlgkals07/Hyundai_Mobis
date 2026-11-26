import fs from "node:fs";
import { spawn } from "node:child_process";
import { once } from "node:events";
const port = process.env.F1_PORT || "19846";
const tab = (
  await (await fetch("http://localhost:" + port + "/json")).json()
).find((t) => t.url.endsWith("/render.html"));
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await once(ws, "open");
let id = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const r = JSON.parse(e.data);
  pending.get(r.id)?.(r);
  pending.delete(r.id);
};
function ask(expression) {
  return new Promise((resolve) => {
    pending.set(++id, resolve);
    ws.send(
      JSON.stringify({
        id,
        method: "Runtime.evaluate",
        params: { expression, returnByValue: true },
      }),
    );
  });
}
const rows = JSON.parse(fs.readFileSync("times.json"));
for (let j = 0; j < rows.length; j++) {
  let frames = rows[j][4];
  const ff = spawn(
    "ffmpeg",
    [
      "-v",
      "error",
      "-y",
      "-f",
      "image2pipe",
      "-framerate",
      "18",
      "-vcodec",
      "mjpeg",
      "-i",
      "pipe:0",
      "-i",
      "v" + j + ".aiff",
      "-af",
      "adelay=250,apad",
      "-t",
      String(frames / 18),
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "18",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-ar",
      "44100",
      "-ac",
      "1",
      "-b:a",
      "96k",
      "clip" + j + ".mp4",
    ],
    { stdio: ["pipe", "inherit", "inherit"] },
  );
  for (let i = 0; i < frames; i++) {
    let q = Math.max(0, Math.min(1, (i - 3) / (frames - 15))),
      res = await ask("solidFrame(" + j + "," + q + ")");
    if (!res.result?.result?.value) throw Error(JSON.stringify(res));
    const buf = Buffer.from(res.result.result.value, "base64");
    if (!ff.stdin.write(buf)) await once(ff.stdin, "drain");
  }
  ff.stdin.end();
  let [code] = await once(ff, "exit");
  if (code !== 0) throw Error("ffmpeg " + code);
  console.log("chapter", j + 1, "/", rows.length);
}
ws.close();
