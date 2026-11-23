"""팔 결합용 수치 (B5N): 그리퍼 점유 공간 vs soft 개방 각, 손바닥 윗면 장착 가능 영역, 실 마찰(capstan), 필요 soft 개방각.

출력: calc/out/envelope.json (docs/ARM-HANDOFF.md 가 인용)
"""
import json
import sympy as sp

deg = sp.pi / 180
c = json.load(open("params/common.json"))
p = json.load(open("params/B5N.json"))
d = json.load(open("calc/out/B5N.json"))["derived"]
zt = c["board_t"] * c["palm_layers"]
xh = p["palm"]["sx"] / 2
Rs = p["soft"]["root_len"] + c["finray"]["L"]
b = c["finray"]["base"]
h = p["hard"]
yp = d["hard_pivot_y"]
out = {}

# 1) soft 개방각 φ 별 x 방향 반폭 (Fin Ray 끝 / 뒤 플랭크 밑변 모서리 중 큰 값) 과 손바닥 위로 솟는 높이
phi = sp.symbols("phi", real=True)
tip_x = xh + Rs * sp.sin(phi)
tip_z = zt - Rs * sp.cos(phi)
back_x = xh + p["soft"]["root_len"] * sp.sin(phi) + b * sp.cos(phi)
back_z = zt - p["soft"]["root_len"] * sp.cos(phi) + b * sp.sin(phi)
rows = []
for a in [90, 60, 45, 30, 20]:
    s = {phi: a * deg}
    rows.append({
        "phi_open_deg": a,
        "half_width_x": round(float(sp.Max(tip_x.subs(s), back_x.subs(s))), 1),
        "top_above_palm_z": round(float(sp.Max(tip_z.subs(s), back_z.subs(s)) - zt), 1),
        "soft_pull_mm": round(float(p["soft"]["drum_r"] * (a * deg - d["soft_phi_min_deg"] * deg)), 1),
    })
out["soft_open_table"] = rows

# 2) 물체를 감싸려면 필요한 soft 개방각: Fin Ray 끝 x ≥ 물체 반폭 + 10
need = {}
for name, half in [("chip", c["objects"]["chip"]["a"]), ("sponge_70", c["objects"]["sponge"]["sx"] / 2), ("kitchen_sponge_110", 55.0)]:
    v = sp.nsolve(tip_x - (half + 10), phi, 0.2)
    need[name] = round(float(v / deg), 1)
out["soft_open_needed_deg"] = need

# 3) hard 점유 (y): 열림 ψ_open 에서 손끝판 바깥 y, 바깥 피벗 드럼 바깥 y
psi = h["psi_open_deg"] * deg
out["hard_half_width_y_open"] = round(float(yp + h["d"] + h["L"] * sp.sin(psi) + 6), 1)
out["hard_drum_outer_y"] = round(float(yp + h["d"] + h["drum_r"]), 1)
out["below_palm_rigid_z"] = round(float(-d["rigid_palm_height"]), 1)

# 4) 손바닥 윗면 장착 가능 영역: soft 드럼(x ≥ xh - r_s, y ∈ drum_y ± 4.5), soft 실 A (x=±(xh - r_s), y=drum_y),
#    텐던 구멍 (x=0, y=±(yp + d - r_h)), 복원 고무줄 고정점 (x=±(xh-14), y=-13) 을 피한 중앙 직사각형
ty = yp + h["d"] - h["drum_r"]
free_x = xh - p["soft"]["drum_r"] - 4  # 실 A 와 드럼에서 4 mm 여유
free_y = ty - 4
out["mount_free_rect"] = {"x_half": round(free_x, 1), "y_half": round(free_y, 1),
                          "note": "가운데 영역. 텐던 루프는 y=±%.1f 로 올라옴 → 장착 기둥 안을 빨대로 통과시키거나 기둥 양옆" % ty}
out["tendon_holes_y"] = round(ty, 1)
out["stringA_x"] = round(xh - p["soft"]["drum_r"], 1)

# 5) 실 마찰: 보우덴(빨대 피복) 안에서 총 꺾임각 θ 일 때 capstan 장력비 e^{μθ} (μ: 실-플라스틱 0.2~0.3 가정)
mu, th = sp.symbols("mu theta", positive=True)
cap = sp.exp(mu * th)
tab = []
for bend in [90, 180, 270, 360]:
    for m in [0.2, 0.3]:
        tab.append({"bend_deg": bend, "mu": m, "tension_ratio": round(float(cap.subs({mu: m, th: bend * deg})), 2)})
out["capstan"] = tab
out["hard_T_N"] = d["hard_string_T_N"]
out["soft_T_N"] = d["soft_string_T_at_limit_N"]
json.dump(out, open("calc/out/envelope.json", "w"), ensure_ascii=False, indent=2)
print(json.dumps(out, ensure_ascii=False, indent=1))
