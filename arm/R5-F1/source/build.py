from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from pathlib import Path
import math, collections
import json, os

OUT = Path(__file__).resolve().parents[1]
PARAMS = Path(os.environ.get("ARM_PARAMS", OUT.parents[1] / "params/arm/R5-F1.json"))
cfg = json.loads(PARAMS.read_text())
u, l, c, b, g, w = map(cfg.get, ("upper", "fore", "column", "base", "guides", "wrist"))
if u["L"] != l["L"]:
    raise ValueError("A level parallel linkage requires equal pin spans")
span = u["L"]
U = u["rear_overhang"] + span + u["front_overhang"]
L = l["rear_overhang"] + span + l["front_overhang"]
pin = c["lower_pin_from_foot"]
space = c["pin_spacing"]
dh = c["h"] - 222

pdfmetrics.registerFont(
    TTFont(
        "ko",
        os.environ.get(
            "KOREAN_TTF", "/System/Library/Fonts/Supplemental/AppleGothic.ttf"
        ),
    )
)
pdf = canvas.Canvas(str(OUT / "R5-F1-A3-원척재단.pdf"), pagesize=(420 * mm, 297 * mm))
pdf.setTitle("R5-F1 | A3 manipulator patterns")
black = "#272a28"
blue = "#00857e"
brown = "#a25a25"
gray = "#656965"
pages = []
parts = []
boxes = []
count = collections.Counter()


def pen(c, w=0.22):
    pdf.setStrokeColor(c)
    pdf.setFillColor(c)
    pdf.setLineWidth(w * mm)


def line(x, y, X, Y, c=blue, w=0.19):
    pen(c, w)
    pdf.line(x * mm, y * mm, X * mm, Y * mm)


def tx(x, y, t, size=7, c=gray):
    pdf.setFillColor(c)
    pdf.setFont("ko", size)
    pdf.drawString(x * mm, y * mm, t)


def ring(x, y, r, c=black):
    pen(c)
    pdf.circle(x * mm, y * mm, r * mm)


def rect(x, y, w, h, c=black):
    pen(c)
    pdf.rect(x * mm, y * mm, w * mm, h * mm)


def pg(title, notes):
    global boxes
    if pages:
        pdf.showPage()
    pages.append(title)
    boxes = []
    tx(298, 272, "R5-F1   /   %02d" % len(pages), 15, blue)
    tx(298, 260, title, 15, black)
    for j, n in enumerate(notes):
        tx(298, 243 - j * 8, n, 8)
    tx(298, 46, "검정 = 재단  /  청록 = 부착·중심  /  갈색 = 접음", 8)
    tx(298, 36, "A3 가로 · 실제 크기 100% · 모든 쪽 각 1장", 8)
    line(298, 20, 398, 20, black)
    line(298, 18, 298, 22, black)
    line(398, 18, 398, 22, black)
    tx(334, 23, "100 mm", 8)


def part(k, x, y, w, h, shape="box", holes=(), inner=0):
    assert x >= 5 and y >= 5 and x + w <= 294 and y + h <= 292, (k, x, y, w, h)
    for X, Y, W, H in boxes:
        assert x >= X + W or x + w <= X or y >= Y + H or y + h <= Y, (
            k,
            x,
            y,
            X,
            Y,
            W,
            H,
        )
    boxes.append((x, y, w, h))
    count[k] += 1
    parts.append((len(pages), k, x, y, w, h))
    if shape == "round":
        ring(x + w / 2, y + h / 2, w / 2)
        if inner:
            ring(x + w / 2, y + h / 2, inner / 2)
    elif shape == "tri":
        line(x, y, x + w, y, black)
        line(x + w, y, x, y + h, black)
        line(x, y + h, x, y, black)
    else:
        rect(x, y, w, h)
    for X, Y, D in holes:
        ring(x + X, y + Y, D / 2)
    if h >= 8 and w >= 8:
        if shape == "round":
            tx(x + w / 2 - 1.7, y + (w - inner) / 4 - 1, k, min(7, w * 0.55))
        else:
            tx(x + 1, y + 1, k, min(7, h * 1.25))


def many(k, x, y, w, h, n, cols, **kw):
    for j in range(n):
        part(k, x + (j % cols) * (w + 3), y + (j // cols) * (h + 3), w, h, **kw)


def guide(x, y, w, h):
    rect(x, y, w, h, blue)


def base(top):
    pg(
        "바닥판 " + ("위" if top else "아래"),
        [
            "F 두 장의 골 방향을 직각으로 맞춘다.",
            "오른쪽이 팔의 정면 (+X)이다.",
            "중앙 Ø10 구멍에 고정 종이축을 세운다.",
            "네 슬롯에 링 고정용 겉종이 띠를 통과시킨다.",
            "P는 회전판 아래 미끄럼 패드 접착 위치.",
            "G는 받침 조작실의 뒤쪽 가이드 받침.",
            "바닥 밑 띠를 펼친 뒤 작업대에 고정한다.",
        ],
    )
    x = y = 8
    side = b["w"]
    part("F", x, y, side, side, holes=[(side / 2, side / 2, 10)])
    cx = cy = x + side / 2
    for ang in [5, 58, 160, 215]:
        pdf.saveState()
        pdf.translate(cx * mm, cy * mm)
        pdf.rotate(ang)
        rect(105, -8, 2, 16)
        guide(91, -8, 12, 16)
        pdf.restoreState()
    if top:
        for ang in [-15, 60, 202.5]:
            pdf.saveState()
            pdf.translate(cx * mm, cy * mm)
            pdf.rotate(ang)
            guide(65, -12, 14, 24)
            pdf.restoreState()
        for sy in [-80, 80]:
            guide(cx - 111, cy + sy - 3.5, 16, 7)
    line(30, 32, 75 if top else 30, 32 if top else 77)
    tx(31, 26, "골 방향")


base(0)
base(1)
for j in [0, 1]:
    pg(
        "회전판과 도넛 링 " + str(j + 1),
        [
            "K 고정 링 2장, D 회전판 2장.",
            "K는 골 방향을 교차해 적층한다.",
            "D는 지름 160의 독립 부품이다.",
            "링과 원판은 서로 다른 쪽에 배치했다.",
            "D 두 장 사이 둘레를 살짝 깎아 실 홈을 낸다.",
        ]
        if j == 0
        else [
            "원판 뒤 두 실 끝을 구멍에 묶고 매듭을 매립.",
            "D 상면의 청록 사각형은 기둥 옆판 발자리.",
            "중심축은 F에만 고정. 원판 구멍 Ø11.",
        ],
    )
    part("K", 10, 50, b["ring_od"], b["ring_od"], "round", inner=b["ring_id"])
    pg(
        "회전 원판 " + str(j + 1),
        [
            "D 지름 160 / 중앙 Ø11.",
            "뒤쪽 두 구멍 Ø2에 받침실을 묶는다.",
            "원판 둘레에 서로 반대로 감고 접선으로 뺀다.",
            "되돌릴 때도 실이 남도록 중간 각도에서 맞춘다.",
        ],
    )
    part(
        "D",
        18,
        48,
        b["rotor_od"],
        b["rotor_od"],
        "round",
        holes=[(14, 56, 2), (14, 104, 2)],
        inner=11,
    )
    if j:
        for a in [-20, 14]:
            guide(98 - 32, 128 + a, 54, 6)
pg(
    "받침 세부 부품",
    [
        "P 3개 / 실이 닿는 면은 매끈하게.",
        "B 3겹씩 × 4기둥 = 9 mm.",
        "바닥 위부터 링 밑까지 실제 목표 9.75 mm.",
        "B에 겉종이 심을 덧대 간극 0.5~1 mm 조정.",
        "띠는 골판지의 겉종이만 벗겨 쓴다.",
        "슬롯 통과 → 바닥 밑 접착 → 링 위로 감쌈.",
        "발 SP는 바닥 밑 모서리에 붙여 띠 두께 피함.",
        "G 받침은 필요 높이까지 겉종이로 조정.",
    ],
)
many("P", 10, 15, 14, 24, 3, 3)
many("B", 10, 55, 12, 16, 12, 6)
many("띠", 10, 110, 65, 14, 4, 4)
many("SP", 10, 145, 26, 20, 4, 4)
many("G", 10, 185, 16, 7, 2, 2)
part("축종이", 10, 215, 120, 12)
tx(12, 231, "겉종이를 Ø10에 맞게 말고 남는 길이는 자름")
pg(
    f"기둥 · {c['h']} mm",
    [
        "T 네 장을 두 장씩 겹쳐 양옆 기둥 제작.",
        f"시트 긴 방향({c['h']} mm)을 따라 골을 둔다.",
        f"바닥에서 {pin} / {pin + space}에 Ø6 시작 구멍.",
        "위·아래 핀은 모두 같은 방향에서 꽂는다.",
        "검정 구멍이 실제 재료와 맞는지 시편부터.",
    ],
)
for i in range(4):
    part(
        "T",
        10 + 59 * i,
        20,
        c["w"],
        c["h"],
        holes=[
            (c["rear_edge_to_pin"], pin, 6),
            (c["rear_edge_to_pin"], pin + space, 6),
        ],
    )
pg(
    "기둥 덧판과 뒤 가이드",
    [
        "TD를 T의 밑에서 141 mm에 맞춰 붙인다.",
        "TB는 두 장씩 적층해 앞뒤 격벽 각 1개.",
        "기둥 안쪽 폭 28. 격벽은 밑에서 132까지만.",
        "BR 삼각 보강은 기둥 양옆 밑에 두 겹씩.",
        "TG 2겹씩 × 양옆. T와 29 mm 이상 겹쳐 붙임.",
        "가이드축 중심은 바닥판 상면이 아닌",
        "작업대 기준 약 65 mm, 중심축 뒤 54 mm.",
        "Ø6 빨대 슬리브에 젓가락 축을 넣는다.",
    ],
)
many(
    "TD",
    10,
    16,
    c["w"],
    76,
    2,
    2,
    holes=[
        (c["rear_edge_to_pin"], pin - 141 - dh, 6),
        (c["rear_edge_to_pin"], pin + space - 141 - dh, 6),
    ],
)
many("TB", 10, 106, 28, 132, 4, 4)
many("BR", 148, 106, 30, 45, 4, 2, shape="tri")
many("TG", 142, 18, 62, 20, 4, 2, holes=[(8, 10, 6)])
for k, w, h, n, holes in [
    (
        "U",
        U,
        u["t"],
        2,
        [
            (u["rear_overhang"], u["t"] / 2, 6),
            (u["rear_overhang"] + span, u["t"] / 2, 6),
            (5, u["t"] / 2, 2),
        ],
    ),
    (
        "UW",
        U,
        u["web_h"],
        2,
        [
            (u["rear_overhang"], u["web_h"] / 2, 6),
            (u["rear_overhang"] + span, u["web_h"] / 2, 6),
            (5, u["web_h"] / 2, 2),
        ],
    ),
    (
        "L",
        L,
        l["t"],
        2,
        [
            (l["rear_overhang"], l["t"] / 2, 6),
            (l["rear_overhang"] + span, l["t"] / 2, 6),
        ],
    ),
]:
    pg(
        {
            "U": "위 링크 옆판",
            "UW": "위 링크 보강판 · 빨대 부착",
            "L": "아래 링크 옆판",
        }[k],
        {
            "U": [
                f"위 링크 두 축의 간격 {span}. 꼬리실 구멍 Ø2.",
                "긴 방향으로 골을 놓는다.",
                "UW를 각 U의 안쪽에 높이 중앙 맞춰 붙인다.",
            ],
            "UW": [
                "UW 두 장은 마주 보는 안쪽 면을 위로 둔다.",
                "좌벽 W 손목 / A Fin Ray, 우벽 B 집게.",
                "각 계통은 12 mm 빨대 두 조각, 총 6개.",
                "붙임 시작점은 뒤 끝에서 92 / 155 mm.",
                "실 먼저 넣고 빨대 바깥쪽에만 글루를 댄다.",
                "현물 빨대 외경 6 mm 이하를 기준으로 함.",
            ],
            "L": [
                f"길이 {L} / 두 축은 뒤에서 {l['rear_overhang']}, {l['rear_overhang'] + span}.",
                "가운데에 부싱을 대고 J를 붙인다.",
                "L은 배선실이 지나가지 않는다.",
            ],
        }[k],
    )
    for j in range(n):
        x, y = 18, 75 + 85 * j
        part(k, x, y, w, h, holes=holes)
        if k == "UW":
            for at in g["start_from_upper_rear"]:
                for cy in [8, 22] if j == 0 else [15]:
                    guide(x + at, y + cy - g["od"] / 2, g["length"], g["od"])
            tx(x + 72, y + 1, "좌벽 W(아래) / A(위)" if j == 0 else "우벽 B")
pg(
    "링크 덮개와 축 덧판",
    [
        "UT 위 링크 덮개 2장. 창 있는 쪽이 윗면.",
        "창 2개로 6개 실을 한꺼번에 빼지 말고",
        "계통별로 묶어 관절 바깥에 여유 고리를 둔다.",
        "덮개를 닫기 전에 6가닥을 각각 손으로 왕복.",
        "LT는 아래 링크와 접착.",
        "J 2겹 × 2면 × 2축 × 2링크 = 16장.",
        "축은 4개. 각 축 바깥에 와셔 2개.",
    ],
)
for j in range(2):
    part("UT", 12, 16 + 25 * j, U, u["w"] - 6)
    if j == 1:
        for x in [78, U - 39]:
            rect(12 + x, 16 + 25 * j + 3, 12, 14)
    many("LT", 12, 73 + j * 26, L, l["w"] - 6, 1, 1)
many("J", 12, 140, 28, 16, 16, 8, holes=[(14, 8, 6)])
many("와셔", 12, 203, 14, 14, 8, 8, shape="round", inner=6)
pg(
    "끝판과 손목 카세트",
    [
        "C 2겹씩 × 좌우. 안쪽 간격 32 mm.",
        "두 축 간격 40. 하축에서 손목 중심은 앞 19.",
        "C 아래 평면에 WR 위 링을 붙인다.",
        "WR 맨 윗면은 하축보다 19 mm 아래.",
        "회전판 RF는 2겹, 완성 두께 6.",
        "WS 각 두 겹 + 2 mm 겉종이 심 = 높이 8.",
        "아래/위 WR 사이에 RF를 먼저 넣는다.",
        "실 출구는 좌우 접선. WS는 앞뒤에 붙인다.",
        "Ø24 목에는 KF와 RF를 접착. WR은 자유.",
    ],
)
many("C", 10, 16, 39, 73, 4, 4, holes=[(13.5, 19, 6), (13.5, 59, 6)])
many("WR", 10, 110, 68, 68, 2, 2, shape="round", inner=26)
many(
    "RF",
    160,
    110,
    40,
    40,
    2,
    2,
    shape="round",
    inner=24,
    holes=[(5, 20, 1.6), (35, 20, 1.6)],
)
# Lower WR: W guides stop before the rotor envelope. Front/rear spacers are outside the rotor.
for off in [-20, 20]:
    guide(44 - 23, 144 + off - 3, 8, 6)
for off in [-28, 28]:
    guide(44 + off - 3, 144 - 5, 6, 10)
tx(9, 103, "아래 WR: 좌우 빨대 8 mm / 앞뒤 WS")
tx(84, 103, "위 WR: C 접착면")
for off in [-19, 19]:
    line(115 - 22, 144 + off, 115 + 5, 144 + off)
part("KF", 180, 180, 30, 30, "round", inner=24)
many("WS", 12, 200, 6, 10, 4, 4)
many("목", 12, 240, 24, 24, 7, 7, shape="round", inner=16)
# 21 mm sleeve via 7 rings; 1 mm optional liner cap
pg(
    "손바닥 접속 · 조작판",
    [
        "손목 목 7겹 = 21 mm, Ø16 통로 유지.",
        "M/I 장착기둥은 15 mm 높이. 홈을 아래로.",
        "손바닥 위 중앙 24 × 30 안에만 접착.",
        "조작판 CP의 5줄 표시는 뒤에서 본 손잡이.",
        "G2 받침 위에 빨대 12 mm를 길이 방향으로.",
        "받침 2 / 올림 1 / 손목 2 / A 2 / B 2.",
        "회전용 손잡이는 한쪽을 당기며 반대쪽을 풀기.",
        "손잡이 막대 HG는 두 겹씩 붙인다.",
        "A 균형막대와 B 움직도르래는 각각 한 벌만.",
    ],
)
part("CP", 12, 18, 118, 212)
for j, cc in enumerate(["받침", "올림", "손목", "A", "B"]):
    y = 18 + 24 + 41 * j
    tx(15, y, cc, 9)
    for off in [0] if j == 1 else [-8, 8]:
        guide(12 + 93, y + off - 3.5, 14, 7)
many("G2", 145, 18, 14, 7, 9, 3)
for j, (k, w) in enumerate([("M", 30), ("I", 18)]):
    for n in range(2):
        x = 145 + n * 40
        y = 74 + j * 28
        part(k, x, y, w, 15)
        rect(x + w / 2 - 3, y, 6, 6)
many("HG", 145, 144, 34, 10, 12, 3, holes=[(5, 5, 2), (17, 5, 2), (29, 5, 2)])
many("고정뿔", 145, 225, 22, 10, 4, 4)
pg(
    "시험편 · 마감 부품",
    [
        "시험편 홀 Ø5 / 5.5 / 6 / 6.5. 부싱 외경과",
        "축 Ø를 실측해 고정측과 회전측을 따로 맞춘다.",
        "손잡이 B 도르래는 BP–BC–BP 3겹.",
        "가운데 Ø4 실측 축으로 BY 포크에 끼운다.",
        "손잡이 실은 BY 뒤 구멍 2개에 함께 묶는다.",
        "AA 받침 4개는 바닥부터 27 mm 높이.",
        "받침 G3을 Ø6 가이드 아래 필요 위치에 겹침.",
        "보강부·접착 전에 각 관절을 손으로 돌려 본다.",
    ],
)
many(
    "시험",
    12,
    18,
    76,
    22,
    2,
    2,
    holes=[(12, 12, 5), (29, 12, 5.5), (46, 12, 6), (63, 12, 6.5)],
)
many("BP", 12, 64, 20, 20, 2, 2, shape="round", inner=4)
part("BC", 61, 64, 16, 16, "round", inner=4)
many("BY", 98, 64, 30, 12, 2, 2, holes=[(7, 6, 4), (24, 6, 2)])
many("받침발", 12, 106, 32, 25, 4, 4)
many("AA", 12, 148, 18, 24, 8, 8)
many("G3", 12, 196, 16, 8, 8, 8)
part("각도", 12, 226, 145, 45)
for a in [3, 18]:
    line(
        17,
        230,
        17 + 122 * math.cos(math.radians(a)),
        230 + 122 * math.sin(math.radians(a)),
    )
    tx(142, 230 + 122 * math.sin(math.radians(a)), str(a))
pdf.save()
assert len(pages) == 16 and len(parts) == 162
print(len(pages), len(parts), dict(count))
