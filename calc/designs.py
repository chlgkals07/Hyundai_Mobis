"""SymPy 검증: baseline별 기하·간섭·구동 조건.

좌표 (mm): z 위. 손바닥 아랫면 z=0, 윗면 z=t_palm. x = soft(Fin Ray) 닫힘축, y = hard 닫힘축.
각도 부호: 손가락 축이 수직 아래(0)에서 '바깥쪽'으로 벌어지면 +, 안쪽으로 닫히면 -.
모든 결과는 calc/out/<ID>.json 으로 저장되어 TS 뷰어와 비교표가 그대로 읽는다.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import sympy as sp

ROOT = Path(__file__).resolve().parent.parent
P = ROOT / "params"
OUT = ROOT / "calc" / "out"

deg = sp.pi / 180


def load(name: str) -> dict:
    return json.loads((P / f"{name}.json").read_text())


def f(x) -> float:
    return float(sp.N(x, 12))


class Report:
    def __init__(self, design: dict, common: dict):
        self.d = design
        self.c = common
        self.checks: list[dict] = []
        self.derived: dict[str, float | str] = {}

    def check(self, cid: str, desc: str, value, lo=None, hi=None, unit=""):
        v = f(value)
        ok = (lo is None or v >= f(lo) - 1e-9) and (hi is None or v <= f(hi) + 1e-9)
        self.checks.append({
            "id": cid, "desc": desc, "value": round(v, 3), "unit": unit,
            "lo": None if lo is None else round(f(lo), 3),
            "hi": None if hi is None else round(f(hi), 3),
            "pass": bool(ok),
        })
        return ok

    def put(self, k: str, v):
        self.derived[k] = round(f(v), 4) if not isinstance(v, str) else v

    def dump(self):
        OUT.mkdir(parents=True, exist_ok=True)
        data = {"id": self.d["id"], "name": self.d["name"], "derived": self.derived, "checks": self.checks,
                "pass": all(c["pass"] for c in self.checks)}
        (OUT / f"{self.d['id']}.json").write_text(json.dumps(data, ensure_ascii=False, indent=2))
        return data


# ---------------------------------------------------------------- 공통: flap 형 soft (B1, B3)

def soft_flap(r: Report, w_hard: float):
    c, d = r.c, r.d
    z_top = c["board_t"] * c["palm_layers"]
    xh = d["palm"]["sx"] / 2  # 힌지 x (손바닥 윗면 바깥 모서리)
    Rs = d["soft"]["root_len"] + c["finray"]["L"]  # 힌지 → Fin Ray 끝 (contact flank 위)
    phi = sp.symbols("phi", real=True)
    tip_x = xh + Rs * sp.sin(phi)
    tip_z = z_top - Rs * sp.cos(phi)
    r.put("soft_hinge_x", xh)
    r.put("soft_reach", Rs)

    # (1) 평면 간섭 스토퍼: tip_x >= w_h/2 + margin
    x_min = w_hard / 2 + c["margin_plan"]
    phi_min = sp.nsolve(tip_x - x_min, phi, -0.1)
    r.put("soft_phi_min_deg", phi_min / deg)
    r.put("soft_x_min", x_min)

    # 물체별 접촉각: 건전지 끝(±25), 칩(±a), 스펀지(±sx/2)
    o = c["objects"]
    phi_b = sp.nsolve(tip_x - o["battery"]["len"] / 2, phi, 0)
    phi_c = sp.nsolve(tip_x - o["chip"]["a"], phi, 0)
    phi_s = sp.nsolve(tip_x - o["sponge"]["sx"] / 2, phi, 0)
    for k, v in (("battery", phi_b), ("chip", phi_c), ("sponge", phi_s)):
        r.put(f"soft_phi_{k}_deg", v / deg)
    r.check("S1", "건전지 끝 접촉각이 스토퍼보다 열린 쪽 (스토퍼가 건전지 지지를 막지 않음)",
            phi_b / deg, lo=phi_min / deg, unit="deg")
    phi_open = d["soft"]["phi_open_deg"] * deg
    r.check("S2", "스펀지 폭이 개방 범위 안", phi_s / deg, hi=phi_open / deg, unit="deg")

    # 완전 개방 시 전체 폭 (Fin Ray 뒤 플랭크 포함) & 드럼 당김량
    base = c["finray"]["base"]
    open_half = xh + Rs * sp.sin(phi_open) + base * sp.cos(phi_open)
    r.put("soft_open_half_width", open_half)
    drum = d["soft"]["drum_r"]
    pull = drum * (phi_open - phi_min)
    r.put("soft_pull_mm", pull)
    # 칩 5 N 접촉점을 Fin Ray 길이 70% 위치로 가정한 줄 장력
    lever = d["soft"]["root_len"] + 0.7 * c["finray"]["L"]
    T = c["force"]["chip_limit_N"] * lever / drum
    r.put("soft_string_T_at_limit_N", T)
    r.check("S3", "칩 한계력에서 실 A 장력 (손으로 당길 만한가, ≤ 40 N)", T, hi=40, unit="N")
    return dict(z_top=z_top, Rs=Rs, tip_x=tip_x, tip_z=tip_z, phi=phi, phi_b=phi_b, phi_c=phi_c,
                phi_min=phi_min)


def finray_window(r: Report, soft_tip_z_batt, z_floor):
    c = r.c
    lo, hi = c["finray_window"]
    h = soft_tip_z_batt - z_floor
    r.put("rigid_finray_tip_above_floor", h)
    r.check("R2", "Rigid(건전지): Fin Ray 끝이 바닥 위 [3,10] mm — 걸리지 않으면서 건전지 옆면에 닿음",
            h, lo=lo, hi=hi, unit="mm")


# ---------------------------------------------------------------- B1

def b1():
    c, d = load("common"), load("B1")
    r = Report(d, c)
    h = d["hard"]
    w_h = h["width"]
    s = soft_flap(r, w_h)
    z_top = s["z_top"]
    face = h["plies"] * c["board_t"] / 2
    yp = d["palm"]["sy"] / 2 + face  # 피벗 축 = 손가락 두께 중심, 손바닥 앞면 바깥
    Lh = h["len"]
    psi = sp.symbols("psi", real=True)
    tip_y = yp + Lh * sp.sin(psi)
    tip_z = z_top - Lh * sp.cos(psi)
    # 안쪽 면 = 축에서 face 만큼 안쪽 법선 방향 (front finger, y>0)
    face_y = tip_y - face * sp.cos(psi)

    o = c["objects"]
    psi_b = sp.nsolve(face_y - o["battery"]["d"] / 2, psi, -0.2)
    psi_cab = sp.nsolve(face_y - o["cable"]["d"] / 2, psi, -0.2)
    psi_min = sp.nsolve(face_y, psi, -0.2)  # 손끝끼리 맞닿음
    r.put("hard_psi_battery_deg", psi_b / deg)
    r.put("hard_psi_cable_deg", psi_cab / deg)
    r.put("hard_psi_min_deg", psi_min / deg)
    r.put("hard_face_wedge_deg", -psi_b / deg)  # 건전지 파지 시 면이 수직이 되도록 패드 쐐기각

    # Rigid(건전지): 손톱 끝이 바닥 → 그 높이가 바닥
    z_floor = tip_z.subs(psi, psi_b)
    r.put("rigid_palm_height", z_top - z_floor)
    soft_tip_batt = s["tip_z"].subs(s["phi"], s["phi_b"])
    finray_window(r, soft_tip_batt, z_floor)

    # Soft(칩): Fin Ray 끝을 바닥 +2 mm 에 두었을 때, 열린 hard 손끝이 그보다 margin_soft 위
    psi_open = h["psi_open_deg"] * deg
    soft_tip_chip = s["tip_z"].subs(s["phi"], s["phi_c"])
    gap = tip_z.subs(psi, psi_open) - soft_tip_chip
    r.put("soft_mode_hard_above_finray", gap)
    r.check("R1", "Soft 모드: 열린 hard 손끝이 Fin Ray 끝보다 위 (≥ margin_soft)", gap,
            lo=c["margin_soft"], unit="mm")
    psi_open_min = sp.nsolve(tip_z - (soft_tip_chip + c["margin_soft"]), psi, 0.6)
    r.put("hard_psi_open_min_deg", psi_open_min / deg)

    # 구동
    rd = h["drum_r"]
    r.put("hard_pull_mm", rd * (psi_open - psi_min))
    T = c["force"]["pinch_target_N"] * Lh / rd
    r.put("hard_string_T_N", T)
    r.check("H1", "pinch 8 N 에서 실 B 장력 ≤ 40 N", T, hi=40, unit="N")
    r.check("H2", "케이블(Ø5) 각이 손끝 맞닿음 각보다 열린 쪽 (케이블 쥘 수 있음)", psi_cab / deg,
            lo=psi_min / deg, unit="deg")
    r.put("plan_hard_half_width", w_h / 2)
    return r.dump()


# ---------------------------------------------------------------- B2

def b2():
    c, d = load("common"), load("B2")
    r = Report(d, c)
    h, so = d["hard"], d["soft"]
    w_h = h["width"]
    face = h["plies"] * c["board_t"] / 2
    o = c["objects"]
    # soft: 수평 슬롯, contact flank x = u
    x_min = w_h / 2 + c["margin_plan"]
    r.put("soft_x_min", x_min)
    Rs = -so["slot_z"] + so["root_len"] + c["finray"]["L"]
    r.put("soft_reach", Rs)
    soft_tip_z = -Rs
    r.check("S1", "건전지 끝(25) ≥ 스토퍼 x_min", o["battery"]["len"] / 2, lo=x_min, unit="mm")
    r.check("S2", "스펀지 반폭 ≤ 개방 x_open", o["sponge"]["sx"] / 2, hi=so["x_open"], unit="mm")
    r.put("soft_pull_mm", so["x_open"] - x_min)
    T = c["force"]["chip_limit_N"]  # 직선 이동: 실 장력 = 접촉력 (마찰 무시)
    r.put("soft_string_T_at_limit_N", T)
    r.check("S3", "칩 한계력에서 실 A 장력 ≤ 40 N (마찰 제외)", T, hi=40, unit="N")
    # 슬롯 벽이 손바닥 안에 들어가는가
    r.check("S4", "soft 슬롯 끝 + 여유가 손바닥 반폭 안", so["x_open"] + 5, hi=d["palm"]["sx"] / 2, unit="mm")

    # hard: 경사 슬롯. 캐리지 y_c 가 줄면 끝이 tan(a) 만큼 내려감
    a = h["slope_deg"] * deg
    yc = sp.symbols("y_c", real=True)
    tip_z = -h["reach_open"] - (h["y_open"] - yc) * sp.tan(a)
    yc_b = o["battery"]["d"] / 2 + face
    z_floor = tip_z.subs(yc, yc_b)
    r.put("rigid_palm_height", -z_floor)
    r.put("hard_drop_battery", (h["y_open"] - yc_b) * sp.tan(a))
    finray_window(r, soft_tip_z, z_floor)
    gap = -h["reach_open"] - soft_tip_z
    r.put("soft_mode_hard_above_finray", gap)
    r.check("R1", "Soft 모드: 열린 hard 손끝이 Fin Ray 끝보다 위 (≥ margin_soft)", gap,
            lo=c["margin_soft"], unit="mm")
    # 실현 가능한 reach_open 구간 도출
    R0 = sp.symbols("R0", positive=True)
    lo, hi = c["finray_window"]
    zf = -R0 - (h["y_open"] - yc_b) * sp.tan(a)
    hgt = soft_tip_z - zf
    r0_lo = sp.solve(sp.Eq(hgt, lo), R0)[0]
    r0_hi = sp.solve(sp.Eq(hgt, hi), R0)[0]
    r0_soft = Rs - c["margin_soft"]
    r.put("hard_reach_open_feasible", f"[{f(r0_lo):.1f}, {min(f(r0_hi), r0_soft):.1f}]")
    r.check("H2", "hard 슬롯 경로가 손바닥 반깊이 안", h["y_open"] + face + 3, hi=d["palm"]["sy"] / 2, unit="mm")
    yc_cab = o["cable"]["d"] / 2 + face
    r.put("hard_pull_mm", (h["y_open"] - yc_cab) / sp.cos(a))
    # 경사 슬롯: 줄이 슬롯 방향으로 당기면 수평 파지력 = T cos(a) (마찰 무시)
    T = c["force"]["pinch_target_N"] / sp.cos(a)
    r.put("hard_string_T_N", T)
    r.check("H1", "pinch 8 N 에서 실 B 장력 ≤ 40 N (마찰 제외)", T, hi=40, unit="N")
    r.put("hard_face_wedge_deg", 0)
    return r.dump()


# ---------------------------------------------------------------- B3

def b3():
    c, d = load("common"), load("B3")
    r = Report(d, c)
    h = d["hard"]
    s = soft_flap(r, h["width"])
    z_top = s["z_top"]
    yp = d["palm"]["sy"] / 2 + h["plies"] * c["board_t"] / 2
    l1, l2 = h["l1"], h["l2"]
    t1, t2 = sp.symbols("t1 t2", real=True)
    tip_y = yp + l1 * sp.sin(t1) + l2 * sp.sin(t1 + t2)
    tip_z = z_top - l1 * sp.cos(t1) - l2 * sp.cos(t1 + t2)
    # 목표 pinch 자세: 손톱 끝 y = target, 원위지골 각 = target
    td = h["target_distal_deg"] * deg
    sol = sp.nsolve([tip_y - h["target_tip_y"], t1 + t2 - td], [t1, t2], [0, -0.5])
    t1p, t2p = sol[0], sol[1]
    r.put("hard_theta1_pinch_deg", t1p / deg)
    r.put("hard_theta2_pinch_deg", t2p / deg)
    t10, t20 = h["theta1_rest_deg"] * deg, h["theta2_rest_deg"] * deg
    # 자유 닫힘: dθ_i = -T r_i / k_i → 경로 비 c = Δθ2/Δθ1 = (r2/k2)/(r1/k1)
    ratio = (t2p - t20) / (t1p - t10)
    r.put("tendon_path_ratio", ratio)
    k2_over_k1 = (h["r2"] / h["r1"]) / ratio
    r.put("tendon_k2_over_k1", k2_over_k1)
    r.check("H3", "원위 관절 스프링이 근위보다 강하지 않아도 됨 (0.2 ≤ k2/k1 ≤ 5, 고무줄로 구현 가능)",
            k2_over_k1, lo=0.2, hi=5)
    z_floor = tip_z.subs({t1: t1p, t2: t2p})
    r.put("rigid_palm_height", z_top - z_floor)
    soft_tip_batt = s["tip_z"].subs(s["phi"], s["phi_b"])
    finray_window(r, soft_tip_batt, z_floor)
    rest_z = tip_z.subs({t1: t10, t2: t20})
    soft_tip_chip = s["tip_z"].subs(s["phi"], s["phi_c"])
    gap = rest_z - soft_tip_chip
    r.put("soft_mode_hard_above_finray", gap)
    r.check("R1", "Soft 모드: 펴진(휴지) hard 손끝이 Fin Ray 끝보다 위 (≥ margin_soft)", gap,
            lo=c["margin_soft"], unit="mm")
    # 텐던 당김량 = r1 Δθ1 + r2 Δθ2
    pull = h["r1"] * (t10 - t1p) + h["r2"] * (t20 - t2p)
    r.put("hard_pull_mm", pull)
    # 손끝 8 N: 원위 관절 모멘트 ≈ F * l2 → T = F l2 / r2 (스프링 몫 제외 하한)
    T = c["force"]["pinch_target_N"] * l2 / h["r2"]
    r.put("hard_string_T_N", T)
    r.check("H1", "pinch 8 N 에서 텐던 장력 ≤ 60 N (원위 관절 기준 하한)", T, hi=60, unit="N")
    r.put("hard_face_wedge_deg", -td / deg)
    return r.dump()


def main():
    res = [b1(), b2(), b3()]
    lines = ["# SymPy 검증 리포트", "", "`python3 calc/run_all.py` 로 재생성. 단위 mm / deg / N.", ""]
    for d in res:
        lines += [f"## {d['name']}  —  {'PASS' if d['pass'] else 'FAIL'}", "",
                  "| ID | 조건 | 값 | 범위 | 결과 |", "|---|---|---|---|---|"]
        for ck in d["checks"]:
            rng = f"[{'' if ck['lo'] is None else ck['lo']}, {'' if ck['hi'] is None else ck['hi']}]"
            lines.append(f"| {ck['id']} | {ck['desc']} | {ck['value']} {ck['unit']} | {rng} | {'✅' if ck['pass'] else '❌'} |")
        lines += ["", "<details><summary>도출 치수</summary>", "", "| 항목 | 값 |", "|---|---|"]
        lines += [f"| `{k}` | {v} |" for k, v in d["derived"].items()]
        lines += ["", "</details>", ""]
    (ROOT / "calc" / "REPORT.md").write_text("\n".join(lines))
    for d in res:
        print(d["id"], "PASS" if d["pass"] else "FAIL", [c["id"] for c in d["checks"] if not c["pass"]])


if __name__ == "__main__":
    main()
