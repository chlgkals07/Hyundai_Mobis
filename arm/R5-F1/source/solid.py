"""Generate voiced 3D assembly MP4. Requires macOS say, Chrome, Node 22+, npm ci, FFmpeg."""

import json, math, os, subprocess as sp, time, urllib.request
from pathlib import Path

here = Path(__file__).resolve().parent
work = Path(os.environ["F1_WORK"]).resolve()
work.mkdir(parents=True, exist_ok=True)
rows = json.loads((here / "chapters.json").read_text())
for i, row in enumerate(rows):
    audio = work / f"v{i}.aiff"
    sp.run(["say", "-v", "Yuna", "-r", "182", "-o", audio, row[3]], check=True)
    sec = float(
        sp.check_output(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "csv=p=0",
                audio,
            ]
        )
    )
    row.append(math.ceil((sec + 1.05) * 18))
(work / "times.json").write_text(json.dumps(rows, ensure_ascii=False))
sp.run(["node", here / "build-scene.mjs"], check=True)
port = os.environ.get("F1_PORT", "19846")
chrome = os.environ.get(
    "CHROME", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
)
browser = sp.Popen(
    [
        chrome,
        "--headless",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
        "--remote-debugging-port=" + port,
        "--user-data-dir=" + str(work / "profile"),
        (work / "render.html").as_uri(),
    ],
    stderr=sp.DEVNULL,
)
try:
    for _ in range(100):
        try:
            tabs = json.load(
                urllib.request.urlopen(f"http://localhost:{port}/json", timeout=1)
            )
            if any(t.get("url") == (work / "render.html").as_uri() for t in tabs):
                break
        except OSError:
            pass
        time.sleep(0.1)
    else:
        raise RuntimeError("Chrome did not open the scene")
    sp.run(["node", here / "encode.mjs"], cwd=work, check=True)
finally:
    browser.terminate()
    browser.wait()
order = [*range(7), 18, *range(7, 18)]
meta = [";FFMETADATA1"]
t = 0
for j in order:
    end = t + rows[j][4] / 18
    meta.extend(
        [
            "[CHAPTER]",
            "TIMEBASE=1/1000",
            f"START={round(t * 1000)}",
            f"END={round(end * 1000)}",
            "title=" + rows[j][0],
        ]
    )
    t = end
(work / "concat").write_text("\n".join(f"file 'clip{j}.mp4'" for j in order))
(work / "meta").write_text("\n".join(meta))
sp.run(
    [
        "ffmpeg",
        "-v",
        "error",
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        "concat",
        "-i",
        "meta",
        "-map",
        "0:v",
        "-map",
        "0:a",
        "-map_chapters",
        "1",
        "-c",
        "copy",
        "-movflags",
        "+faststart",
        "R5-F1-3D-부품조립과-실끼우기.mp4",
    ],
    cwd=work,
    check=True,
)
