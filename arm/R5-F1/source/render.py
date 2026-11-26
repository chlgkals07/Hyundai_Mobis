from steps import steps
from draw import drawpage, P
from pathlib import Path
import subprocess as sp, concurrent.futures, math

out = P


def make(pair):
    i, step = pair
    stage = P / f"s{i:02}"
    stage.mkdir(exist_ok=True)
    voice = stage / "audio.aiff"
    spoken = (
        (step[2] + ". " + step[3].replace(" / ", ". ") + " " + step[4])
        .replace("Ø", " 지름 ")
        .replace("°", " 도 ")
        .replace("mm", " 밀리미터 ")
        .replace("→", " 다음 ")
        .replace("~", "에서 ")
    )
    sp.run(
        ["say", "-v", "Yuna (한국어(한국))", "-r", "205", "-o", str(voice), spoken],
        check=True,
    )
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
                voice,
            ]
        )
    )
    dur = math.ceil((sec + 0.65) * 12) / 12
    items = []
    for k in range(12):
        f = stage / f"{k:02}.jpg"
        drawpage(step, i, k / 11).save(f, quality=91)
        items += ["file '" + str(f) + "'", "duration " + str(dur / 12)]
    items += ["file '" + str(f) + "'"]
    (stage / "frames").write_text("\n".join(items))
    sp.run(
        [
            "ffmpeg",
            "-loglevel",
            "error",
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(stage / "frames"),
            "-i",
            str(voice),
            "-vf",
            "fps=12",
            "-af",
            "apad",
            "-t",
            str(dur),
            "-pix_fmt",
            "yuv420p",
            "-c:v",
            "libx264",
            "-threads",
            "2",
            "-preset",
            "veryfast",
            "-crf",
            "19",
            "-c:a",
            "aac",
            "-ar",
            "44100",
            "-ac",
            "1",
            "-b:a",
            "80k",
            str(stage / "part.mp4"),
        ],
        check=True,
    )
    return dur


with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    times = list(pool.map(make, enumerate(steps)))
meta = [";FFMETADATA1"]
pos = 0
lst = []
for i in [*range(10), 26, *range(10, 16), 27, *range(16, 26)]:
    dur, step = times[i], steps[i]
    f = P / f"s{i:02}" / "part.mp4"
    dt = float(
        sp.check_output(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "csv=p=0",
                f,
            ]
        )
    )
    lst.append("file '" + str(f) + "'")
    meta += [
        "[CHAPTER]",
        "TIMEBASE=1/1000",
        f"START={round(pos * 1000)}",
        f"END={round((pos + dt) * 1000)}",
        "title=" + step[2],
    ]
    pos += dt
(P / "meta").write_text("\n".join(meta))
(P / "concat").write_text("\n".join(lst))
sp.run(
    [
        "ffmpeg",
        "-loglevel",
        "error",
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        str(P / "concat"),
        "-i",
        str(P / "meta"),
        "-map",
        "0:v",
        "-map",
        "0:a",
        "-map_chapters",
        "1",
        "-map_metadata",
        "1",
        "-c",
        "copy",
        "-movflags",
        "+faststart",
        str(out / "R5-F1-조립과-배선.mp4"),
    ],
    check=True,
)
print(pos)
