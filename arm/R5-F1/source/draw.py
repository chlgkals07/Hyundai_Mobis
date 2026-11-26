from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import math
import os

P = Path(os.environ["F1_WORK"])
fontpath = "/System/Library/Fonts/AppleSDGothicNeo.ttc"
fonts = {
    i: ImageFont.truetype(fontpath, i)
    for i in [14, 16, 18, 20, 22, 23, 24, 26, 28, 30, 34, 38]
}
paper = "#f8f5ec"
wood = "#d5ab73"
dark = "#453a31"
teal = "#207f7b"
sand = "#f1dec0"
red = "#a84038"
blue = "#366fa3"
green = "#387840"
violet = "#785899"
white = "#fffdf6"


def drawpage(step, idx, t):
    pg, kind, title, inst, test = step
    im = Image.new("RGB", (1280, 720), paper)
    d = ImageDraw.Draw(im)

    def txt(x, y, s, size=20, c=dark):
        d.text((x, y), s, font=fonts[size], fill=c)

    def box(x, y, w, h, s="", fill=wood):
        d.rectangle((x, y, x + w, y + h), fill=fill, outline=dark, width=2)
        if s:
            txt(x + 5, y + 2, s, 18)

    def circ(x, y, r, fill=white):
        d.ellipse((x - r, y - r, x + r, y + r), fill=fill, outline=dark, width=2)

    def path(points, c=teal, w=4):
        d.line(points, fill=c, width=w, joint="curve")

    def arrow(x, y, X, Y, c=red):
        a = math.atan2(Y - y, X - x)
        path([(x, y), (X, Y)], c, 4)
        d.polygon(
            [
                (X, Y),
                (X - 14 * math.cos(a - 0.45), Y - 14 * math.sin(a - 0.45)),
                (X - 14 * math.cos(a + 0.45), Y - 14 * math.sin(a + 0.45)),
            ],
            fill=c,
        )

    def tube(x, y, w=56):
        d.rounded_rectangle(
            (x, y, x + w, y + 14), 6, fill="#75c6b5", outline=teal, width=2
        )

    def knots(x, y):
        for k in range(2):
            d.ellipse(
                (x - 7 + k * 6, y - 5, x + 5 + k * 6, y + 6), outline=red, width=3
            )

    def board(y):
        box(55, y, 630, 22, "", wood)

    txt(35, 18, "R5-F1   /   로봇팔 제작", 20, teal)
    txt(
        35,
        53,
        f"{ ({26: '10a', 27: '16a'}.get(idx, str(idx + 1).zfill(2))) }   {title}",
        34,
    )
    txt(1080, 30, f"A3 도면   {pg:02d}쪽", 20, teal)
    d.rounded_rectangle((24, 125, 760, 529), 12, fill=white)
    txt(46, 140, "조립 상세  ·  비례 생략", 16, teal)
    dx = int((1 - t) * 72)
    if kind == "section":
        box(210, 200, 214, 245, "")
        box(255, 213, 125, 219, "", white)
        for x, y, col, lab in [
            (279, 366, blue, "W 손목"),
            (279, 266, green, "A Fin Ray"),
            (357, 316, red, "B 집게"),
        ]:
            circ(x + dx // 6, y, 20, "#72b7ac")
            circ(x + dx // 6, y, 14, white)
            for shift in [-5, 5]:
                circ(x + shift + dx // 6, y, 2, col)
            txt(459, y - 12, lab, 22, col)
        txt(89, 455, "단면  ·  내폭 14 mm / 높이 30 mm", 22)
    elif kind == "tangent":
        x, y = 375, 339
        circ(x, y, 143, sand)
        circ(x, y, 84, wood)
        circ(x, y, 52, white)
        for v in [-1, 1]:
            yy = y + v * 84
            tube(x - 97, yy - 7, 34)
            path([(127, yy), (x, yy)], blue, 3)
            pts = [
                (
                    x + 84 * math.cos(v * (math.pi / 2 - a / 100)),
                    y + 84 * math.sin(v * (math.pi / 2 - a / 100)),
                )
                for a in range(int(20 + 72 * t))
            ]
            path(pts, blue, 3)
            knots(*pts[-1])
            box(x + v * 118 - 9, y - 17, 18, 34, "")
        txt(474, 198, "RF 회전판", 20)
        txt(87, 455, "W 두 가닥은 접선 방향 / WS는 앞뒤", 22)
    elif kind == "scale":
        box(90, 245, 500, 110, "시험편")
        for j in range(4):
            circ(155 + j * 116, 300, 14 + j * 2)
            txt(132 + j * 116, 365, ["Ø5", "Ø5.5", "Ø6", "Ø6.5"][j])
        tube(125, 210 - dx, 58)
        arrow(152, 227 - dx, 152, 279)
        txt(120, 425, "시험편 → 실제 빨대 → 젓가락", 24)
    elif kind in ["base", "pads", "ret", "strap", "disk"]:
        board(443)
        txt(73, 469, "F  바닥판", 18)
        if kind == "base":
            box(58, 396 - dx, 627, 20, "F")
            arrow(370, 320, 370, 385 - dx // 2)
            txt(120, 230, "골 방향   1층 ↔     2층 ↕", 26)
        else:
            for x in [167, 523]:
                box(x, 424, 35, 18, "P")
            box(352, 388, 18, 55, "")
            if kind != "pads":
                box(142, 399 - dx * 0.25, 444, 24, "D  회전판")
            if kind == "pads":
                txt(125, 290, "같은 높이의 패드 3곳", 26)
                arrow(176, 340 - dx, 176, 419)
            if kind == "disk":
                path([(90, 390), (160, 400), (270, 405), (306, 405)], violet)
                knots(306, 405)
                arrow(304, 350, 304, 390)
                txt(115, 250, "두 실은 반대로 감고 매듭을 판 안에 숨김", 22)
            if kind in ["ret", "strap"]:
                for x in [98, 608]:
                    for j in range(3):
                        box(x, 425 - j * 13, 36, 13)
                for x in [95, 552]:
                    box(x, 377 - dx * 0.35, 93, 19, "K")
                if kind == "strap":
                    path(
                        [(145, 378), (92, 378), (87, 447), (74, 463), (125, 464)],
                        red,
                        5,
                    )
                    txt(120, 240, "겉종이 띠를 슬롯 아래로 통과", 24)
                    arrow(92, 324 - dx, 92, 368)
                else:
                    txt(115, 240, "9 mm 다리 + 겉종이 심", 24)
                    arrow(612, 309, 612, 367 - dx // 3)
    elif kind in ["mast", "mast2"]:
        board(449)
        box(250, 207, 34, 242, "T")
        box(423, 207, 34, 242, "T")
        box(286, 343 - dx * 0.3, 134, 105, "TB")
        txt(290, 308, "안쪽 28 mm", 20)
        for x in [265, 439]:
            for y in [235, 275]:
                circ(x, y, 5)
        if kind == "mast2":
            box(113, 357, 148, 22, "TG")
            circ(134, 368, 6)
            path([(100, 432), (134, 376), (156, 359), (188, 246)], red)
            txt(83, 206, "뒤 가이드", 22)
        else:
            arrow(355, 237, 355, 330 - dx // 3)
    elif kind in ["link", "guides", "thread", "lid", "pin", "lift", "stops"]:
        if kind in ["guides", "thread", "lid"]:
            box(66, 249, 606, 88, "UW 안쪽")
            for j, (yy, c) in enumerate([(276, blue), (307, green)]):
                for x in [302, 475]:
                    tube(x, yy - 7, 45)
                if kind != "guides":
                    path([(101, yy), (int(108 + 540 * t), yy)], c, 3)
            if kind == "guides":
                arrow(324, 198 - dx // 3, 324, 264)
                txt(84, 370, "뒤 끝 → 92 mm, 155 mm에서 붙이기")
            elif kind == "thread":
                txt(80, 366, "좌벽 아래 W / 위 A", 22)
                txt(80, 404, "맞은편 우벽 중앙 B · 각 관에 실 두 가닥", 22)
            else:
                box(68, 186 - dx // 2, 605, 26, "UT")
                box(273, 188 - dx // 2, 29, 20, "", white)
                box(535, 188 - dx // 2, 29, 20, "", white)
                arrow(183, 222 - dx // 2, 183, 244)
                txt(86, 384, "창으로 꼬리를 모두 꺼낸 뒤 임시로 닫기", 22)
        elif kind == "link":
            for y in [244, 345]:
                box(78, y, 548, 36, "U / UW")
            for x in [235, 567]:
                for y in [244, 345]:
                    box(x - 22, y - 4 - dx * 0.25, 45, 29, "J")
                    circ(x, y + 10 - dx * 0.25, 5)
            txt(95, 407, "구멍마다 J 두 겹 · 축을 지그로 맞춤", 23)
        else:
            box(205, 220, 32, 230, "T")
            box(547, 216, 28, 152, "C")
            for yy in [238, 305]:
                box(125 if yy == 238 else 196, yy, 449 if yy == 238 else 378, 19)
                for x in [221, 558]:
                    circ(x, yy + 9, 7, teal)
            if kind == "lift":
                path([(77, 437), (116, 400), (134, 247)], red)
                tube(117, 239, 32)
                knots(134, 245)
                arrow(81, 363 - dx, 78, 414)
                txt(268, 393, "뒤 꼬리 ↓    손목 ↑", 24)
            elif kind == "pin":
                arrow(560, 178 - dx // 4, 560, 221)
                txt(260, 398, "네 개 핀은 바깥에서 삽입", 23)
            else:
                path([(134, 250), (145, 407), (218, 423)], violet)
                path([(455, 250), (438, 283), (219, 425)], green)
                txt(276, 405, "3° 하한 / 18° 상한", 22)
    elif kind in ["neck", "rotor", "cassette", "palm", "feed", "join"]:

        def pair(x, y, outer, inner, h, k):
            box(x - outer, y, outer - inner, h, k)
            box(x + inner, y, outer - inner, h)

        x = 361
        pair(x, 275, 89, 30, 15, "WR")
        pair(x, 239 - dx * 0.35, 89, 30, 14, "WR")
        pair(x, 248, 25, 15, 82, "")
        pair(x, 296, 40, 25, 12, "")
        pair(x, 256 + dx * 0.12, 55, 25, 13, "")
        if kind in ["neck", "rotor", "cassette"]:
            txt(72, 340, "중공축 Ø24 / 안쪽 Ø16", 22)
            if kind == "neck":
                arrow(x, 200 - dx // 2, x, 244)
                txt(74, 387, "중앙 통로를 열어 두고 아래 와셔부터", 22)
            elif kind == "rotor":
                path([(103, 234), (239, 254), (300, 263)], blue)
                knots(310, 263)
                arrow(150, 213, 220, 232)
                txt(75, 390, "RF 두 장 사이에 W 매듭 매립", 22)
            else:
                for px in [276, 429]:
                    box(px, 252, 15, 22, "")
                arrow(420, 195 - dx // 2, 420, 230)
                txt(74, 390, "상·하 WR 사이 8 mm / RF 두께 6 mm", 22)
        else:
            for px in [326, 386]:
                box(px, 319 + dx * 0.2, 12, 47, "")
            box(216, 365 + dx * 0.2, 286, 16, "B5N 손바닥")
            for px in [242, 465]:
                circ(px, 408, 16, wood)
            if kind in ["feed", "join"]:
                for sign, col in [(-1, green), (1, red)]:
                    path(
                        [
                            (x + sign * 8, 190),
                            (x + sign * 8, 320),
                            (x + sign * 39, 350),
                            (x + sign * 110, 391),
                        ],
                        col,
                    )
                    knots(x + sign * 110, 392)
            txt(
                82,
                454,
                {
                    "palm": "아래 옆문을 남겨 네 실을 분리",
                    "feed": "A 좌우 / B 앞뒤 → 목 안에서 매듭 없이 통과",
                    "join": "손바닥 중앙에 맞춰 KF 아래에 결합",
                }[kind],
                22,
            )
    elif kind in ["panel", "handles", "balance"]:
        if kind == "panel":
            box(97, 194, 528, 287, "CP")
            for j, lab in enumerate(["받침", "올림", "손목", "A", "B"]):
                y = 237 + j * 50
                txt(120, y - 13, lab, 18)
                for delta in [0] if j == 1 else [-9, 9]:
                    tube(450, y + delta - 6, 55)
                    path([(185, y + delta), (int(200 + t * 385), y + delta)], blue, 2)
        elif kind == "handles":
            for x in [270, 380]:
                box(x, 315, 43, 38, "")
            path(
                [
                    (90, 275),
                    (275, 303),
                    (419, 350),
                    (426, 306),
                    (283, 356),
                    (265, 316),
                    (406, 306),
                    (510, 305),
                ],
                red,
            )
            arrow(460, 270, 520, 285)
            txt(103, 406, "두 고정뿔에 8자로 감고 끝을 걸기", 22)
        else:
            box(96, 280, 217, 26, "HG")
            path([(111, 216), (111, 290), (110, 300)], green)
            path([(296, 216), (296, 290)], green)
            path([(202, 300), (202, 410)], green)
            circ(508, 294, 41, wood)
            path(
                [
                    (464, 212),
                    (464, 294),
                    (472, 321),
                    (502, 337),
                    (530, 330),
                    (550, 301),
                    (550, 212),
                ],
                red,
            )
            path([(508, 294), (508, 405)], brown if False else violet)
            txt(110, 433, "A  균형막대", 22)
            txt(445, 433, "B  움직도르래", 22)
    else:
        if kind == "pick":
            for x in [160, 515]:
                box(x, 385, 53, 54, "AA")
                box(x - 14, 440, 81, 12, "")
            d.rounded_rectangle((157, 325 - dx, 565, 384 - dx), 20, fill="#626c75")
            box(527, 328 - dx, 32, 52, "", "#d3a760")
            arrow(380, 253, 380, 317 - dx // 2)
            txt(150, 470, "가운데를 비워 손톱이 들어갈 공간 확보", 20)
        else:
            box(195, 195, 35, 246, "T")
            box(200, 205, 390, 20)
            box(200, 266, 390, 19)
            box(568, 205, 22, 130, "C")
            path([(579, 335), (579, 368)], red)
            box(538, 369, 80, 47, "추")
            for j in range(8):
                path(
                    [(640, 300 + 16 * j), (668 if j % 2 == 0 else 655, 300 + 16 * j)],
                    teal,
                    2,
                )
            txt(102, 459, "60초 유지 → 20회 왕복 → AA 10회 운반", 22)
    # right-hand real pattern detail
    src = Image.open(P / "pages" / f"p-{pg:02}.png").convert("RGB")
    W, H = src.size
    src = src.crop((int(W * 0.012), int(H * 0.012), int(W * 0.703), int(H * 0.987)))
    src.thumbnail((463, 343))
    d.rounded_rectangle((780, 125, 1254, 529), 12, fill="white")
    im.paste(src, (1016 - src.width // 2, 175 + (338 - src.height) // 2))
    txt(799, 140, f"실제 재단도   {pg:02d}쪽", 16, teal)
    for n, line in enumerate(inst.split(" / ")):
        txt(38, 548 + n * 36, line, 20)
    d.rectangle((24, 633, 1254, 690), fill="#e6efe7")
    txt(40, 648, "확인", 20, green)
    txt(99, 650, test, 18)
    return im
