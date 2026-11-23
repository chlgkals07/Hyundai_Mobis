"""개구 범위(잡을 수 있는 물체 크기) — B2(직선) vs B3(회전·텐던) vs B1. SymPy 로 계산."""
import json, sympy as sp
deg = sp.pi / 180
L = lambda n: json.load(open(f"params/{n}.json"))
c = L("common"); fr = c["finray"]; zt = c["board_t"] * c["palm_layers"]
out = {}
# --- B2: 직선 슬롯 → 개구 = 슬롯 스트로크, 손바닥 아래 가운데 벽이 높이를 제한
p = L("B2"); h = p["hard"]; face = h["plies"] * c["board_t"] / 2 + c["pad_t"]
al = h["slope_deg"] * deg
yMin = face + sp.Rational(3, 10)
wall_bot = -12 - (h["y_open"] - yMin) * sp.tan(al) - 12
softH = -p["soft"]["slot_z"] + p["soft"]["root_len"] + fr["L"] - 2   # soft 모드 손바닥 높이 (Fin Ray 끝 바닥+2)
out["B2"] = {"x_max(Fin Ray 개구)": 2 * p["soft"]["x_open"], "y_max(hard 개구)": 2 * (h["y_open"] - face),
             "z_max(가운데 벽 아래, soft 모드)": softH + wall_bot, "손바닥": f'{p["palm"]["sx"]}x{p["palm"]["sy"]}'}
# --- B3: 플랩 90° 개방, 텐던 θ1 40° 휴지
p = L("B3"); h = p["hard"]; yp = p["palm"]["sy"] / 2 + h["plies"] * c["board_t"] / 2
t = h["theta1_rest_deg"] * deg
tip_y = yp + (h["l1"] + h["l2"]) * sp.sin(t); tip_z = zt - (h["l1"] + h["l2"]) * sp.cos(t)
Rs = p["soft"]["root_len"] + fr["L"]
out["B3"] = {"x_max(Fin Ray 개구, 플랩 수평)": 2 * (p["palm"]["sx"] / 2 + Rs), "y_max(텐던 손끝 휴지 간격)": 2 * (tip_y - face),
             "z_max": "제한 없음 (손바닥 아래 고정 구조물 없음)", "손바닥": f'{p["palm"]["sx"]}x{p["palm"]["sy"]}'}
# --- B1
p = L("B1"); h = p["hard"]; yp = p["palm"]["sy"] / 2 + h["plies"] * c["board_t"] / 2
t = h["psi_open_deg"] * deg
out["B1"] = {"x_max": 2 * (p["palm"]["sx"] / 2 + p["soft"]["root_len"] + fr["L"]), "y_max": 2 * (yp + h["len"] * sp.sin(t) - face),
             "z_max": "제한 없음", "손바닥": f'{p["palm"]["sx"]}x{p["palm"]["sy"]}'}
# 일반 주방 스펀지 110x70x40 를 B2 에 넣을 수 있나
sp_ = (110, 70, 40)
b2 = out["B2"]
fits = [(a, b) for a, b in [(sp_[0], sp_[1]), (sp_[1], sp_[0])] if a <= b2["x_max(Fin Ray 개구)"] and b <= b2["y_max(hard 개구)"]]
out["B2"]["주방 스펀지 110x70x40 (어느 방향이든)"] = "들어감" if fits and sp_[2] <= b2["z_max(가운데 벽 아래, soft 모드)"] else "안 들어감"
for k, v in out.items():
    print(k, {kk: (round(float(vv), 1) if not isinstance(vv, str) else vv) for kk, vv in v.items()})
