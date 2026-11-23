"""SymPy 검증: baseline별 기하·간섭·구동 조건.

좌표 (mm): z 위. 손바닥 아랫면 z=0, 윗면 z=t_palm. x = soft(Fin Ray) 닫힘축, y = hard 닫힘축.
각도 부호: 손가락 축이 수직 아래(0)에서 '바깥쪽'으로 벌어지면 +, 안쪽으로 닫히면 -.
모든 결과는 calc/out/<ID>.json 으로 저장되어 TS 뷰어와 비교표가 그대로 읽는다.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
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
    # 한쪽 플랩 = Fin Ray 2개, 손가락당 한계 F/2. 접촉점을 끝(최악, 레버 Rs)으로 둔 보수적 줄 장력
    #   T = 2 * (F/2) * Rs / r  (시뮬에서 칩 접촉이 손끝 근처로 나와 70% 가정은 낙관적이었음)
    T = c["force"]["chip_limit_N"] * Rs / drum
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
    half_t = h["plies"] * c["board_t"] / 2
    face = half_t + c["pad_t"]  # 축 → 패드 표면
    yp = d["palm"]["sy"] / 2 + half_t  # 피벗 축 = 손가락 두께 중심, 손바닥 앞면 바깥
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

    # Rigid(건전지) — 실제 조건: 손톱 끝이 바닥에 닿은 채, 쥐는 면(축에서 face 안쪽 평행선)이 원통에 접함.
    #   (처음엔 '면 y = 반지름' 을 손톱 끝 높이에서 맞췄는데, 원통은 바닥에서 폭이 0 이라 시뮬에서
    #    손가락이 더 닫히며 끝이 들려 적도에서 닿는 것이 드러남 → 접선 조건으로 교체)
    zf = sp.symbols("z_f", real=True)

    def tangent(rad):
        N = sp.Matrix([sp.cos(psi), sp.sin(psi)])
        Cc = sp.Matrix([0 - yp, zf + rad - z_top])
        eqs = [-(Cc.dot(N)) - face - rad, zf - tip_z]
        return sp.nsolve(eqs, [psi, zf], [-0.3, -100])

    sol = tangent(o["battery"]["d"] / 2)
    psi_b, z_floor = sol[0], sol[1]
    r.put("hard_psi_battery_deg", psi_b / deg)
    r.put("hard_face_wedge_deg", -psi_b / deg)
    sol_c = tangent(o["cable"]["d"] / 2)
    r.put("hard_psi_cable_tangent_deg", sol_c[0] / deg)
    r.put("rigid_palm_height_cable", -sol_c[1])
    r.put("rigid_palm_height", -z_floor)  # 손바닥 아랫면(z=0) 기준
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
    face = h["plies"] * c["board_t"] / 2 + c["pad_t"]
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
    # 캐리지 핀 2개 (u+4, u+10) + 벽 여유 3 이 손바닥 안
    r.check("S4", "soft 슬롯(핀 u+10) + 여유 3 이 손바닥 반폭 안", so["x_open"] + 13, hi=d["palm"]["sx"] / 2, unit="mm")

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

def hard_tendon(r: Report, z_top, soft_tip_batt, soft_tip_chip):
    """2마디 텐던 hard (B3, B4 공용). soft 쪽 Fin Ray 끝 높이를 받아 높이 순서를 검사."""
    c, d = r.c, r.d
    h = d["hard"]
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
    # path_ratio 가 있으면(B3o) 공중 경로가 pinch 를 지나지 않고 바닥에 먼저 닿아 미끄러지는 설계 → 그 비를 그대로 사용
    ratio = h["path_ratio"] if "path_ratio" in h else (t2p - t20) / (t1p - t10)
    r.put("tendon_path_ratio", ratio)
    k2_over_k1 = (h["r2"] / h["r1"]) / ratio
    r.put("tendon_k2_over_k1", k2_over_k1)
    r.check("H3", "원위 관절 스프링이 근위보다 강하지 않아도 됨 (0.2 ≤ k2/k1 ≤ 5, 고무줄로 구현 가능)",
            k2_over_k1, lo=0.2, hi=5)
    z_floor = tip_z.subs({t1: t1p, t2: t2p})
    r.put("rigid_palm_height", -z_floor)  # 손바닥 아랫면(z=0) 기준
    finray_window(r, soft_tip_batt, z_floor)
    rest_z = tip_z.subs({t1: t10, t2: t20})
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
    if "path_ratio" in h:
        # J: jam-free — 공중 경로가 pinch 보다 바깥에서 바닥에 닿고, 바닥 미끄럼 구간에서 텐던 당김 → 손톱 안쪽
        s = sp.symbols("s", real=True)
        z_path = tip_z.subs({t1: t10 - s, t2: t20 - ratio * s})
        y_path = tip_y.subs({t1: t10 - s, t2: t20 - ratio * s})
        s0 = None
        for k in range(1, 400):
            sk = k * 0.25 * deg
            if float(z_path.subs(s, sk)) <= float(z_floor):
                s0 = sk
                break
        r.check("J1", "공중 닫힘 경로의 첫 바닥 접촉이 pinch 보다 바깥 (y0 - pinch y ≥ 2)",
                (y_path.subs(s, s0) - h["target_tip_y"]) if s0 else -99, lo=2, unit="mm")
        th1_0 = t10 - s0
        th12 = sp.acos((z_top - l1 * sp.cos(t1) - z_floor) / l2)
        dex = sp.diff(h["r1"] * t1 + h["r2"] * (th12 - t1), t1)
        vals = []
        for k in range(41):  # 접촉점 근처는 acos 인자가 반올림으로 1 을 살짝 넘을 수 있어 실수 값만 사용
            v = sp.N(dex.subs(t1, t1p + (th1_0 - t1p) * k / 40))
            if v.is_real:
                vals.append(float(v))
        r.put("slide_dex_min", min(vals))
        r.check("J2", "바닥 미끄럼 구간 내내 텐던을 당길수록 손톱이 안쪽 (d(r1θ1+r2θ2)/dθ1 > 0, 최소값)", min(vals), lo=0)
        # J3: 복원 고무줄이 미끄럼을 막지 않을 강성 상한. 바닥 위 1자유도에서 dE/dθ1 > 0 이어야 안쪽으로 진행:
        #   k1(θ1-θ10) + k2(θ2-θ20)θ2' + T(r1 + r2 θ2') > 0  →  T > k1 · g(θ1),
        #   g = -[(θ1-θ10) + (k2/k1)(θ2-θ20)θ2'] / (r1 + r2 θ2')
        th2 = th12 - t1
        th2p = sp.diff(th2, t1)
        g = -((t1 - t10) + k2_over_k1 * (th2 - t20) * th2p) / (h["r1"] + h["r2"] * th2p)
        gv = []
        for k in range(41):
            v = sp.N(g.subs(t1, t1p + (th1_0 - t1p) * k / 40))
            if v.is_real:
                gv.append(float(v))
        g_max = max(gv)
        T_max = c["force"]["pinch_target_N"] * l2 / h["r2"]
        k1_max = 0.6 * T_max / g_max  # 최대 장력의 60% 로 미끄럼 완료 (여유 40%)
        r.put("slide_g_max_rad_per_mm", g_max)
        r.put("tendon_k1_max_Nmm_per_rad", k1_max)
        r.put("tendon_k2_max_Nmm_per_rad", k1_max * k2_over_k1)
        # 고무줄 사양으로: J1 에서 휴지→pinch 각 변화 동안 바깥 고무줄 모멘트 (레버 = 손가락 두께 반 + 고리)
        r.put("J1_rubber_moment_at_pinch_Nmm", k1_max * float(t10 - t1p))
        # J4: 미끄럼 중 가장 낮은 점이 손톱 끝이어야 함 (원위가 바깥으로 기울면 패드 쪽 모서리가 내려옴)
        th12_0 = float(sp.N((t10 - s0) + (t20 - ratio * s0)))
        need = (h["plies"] * c["board_t"] / 2 + c["pad_t"]) * np.tan(max(th12_0, 0)) + 1.0
        r.put("touchdown_distal_deg", th12_0 * 180 / np.pi)
        r.check("J4", "손톱 길이 ≥ (반두께+패드)·tan(접촉 시 원위각) + 1 — 패드 모서리가 바닥을 긁지 않음",
                h["nail_len"], lo=need, unit="mm")
        # J5: 실제 고무줄 k1_spec 에서 바닥 미끄럼 안쪽 구동력 최소 ≥ 1 N (마찰 여유). 방향(J2)만으로는 부족했음.
        if "k1_spec_Nmm_per_rad" in h:
            k1s = h["k1_spec_Nmm_per_rad"]
            E = sp.Rational(1, 2) * k1s * (t1 - t10) ** 2 + sp.Rational(1, 2) * k1s * k2_over_k1 * (th2 - t20) ** 2 \
                + T_max * (h["r1"] * t1 + h["r2"] * th2)
            y_sl = yp + l1 * sp.sin(t1) + l2 * sp.sin(th12)
            Ft = sp.diff(E, t1) / sp.diff(y_sl, t1)
            fv = []
            for k in range(1, 40):
                v = sp.N(Ft.subs(t1, t1p + (th1_0 - t1p) * k / 40))
                if v.is_real:
                    fv.append(float(v))
            r.put("slide_drive_min_N", min(fv))
            r.check("J5", f"k1={k1s:g} N·mm/rad 고무줄로 바닥 미끄럼 안쪽 구동력 최소 ≥ 1 N", min(fv), lo=1.0, hi=None, unit="N")
            r.check("J3", "설계 k1 이 상한 이하 & 휴지 유지 하한(20) 이상", k1s, lo=20, hi=k1_max, unit="N·mm/rad")
        r.check("J3b", "k1 상한이 고무줄로 구현 가능한 범위 (≥ 20 N·mm/rad: 너무 약하면 휴지 자세 유지 못함)", k1_max, lo=20, unit="N·mm/rad")


def b3():
    c, d = load("common"), load("B3")
    r = Report(d, c)
    s = soft_flap(r, d["hard"]["width"])
    hard_tendon(r, s["z_top"], s["tip_z"].subs(s["phi"], s["phi_b"]), s["tip_z"].subs(s["phi"], s["phi_c"]))
    return r.dump()


def b3o():
    c, d = load("common"), load("B3o")
    r = Report(d, c)
    s = soft_flap(r, d["hard"]["width"])
    hard_tendon(r, s["z_top"], s["tip_z"].subs(s["phi"], s["phi_b"]), s["tip_z"].subs(s["phi"], s["phi_c"]))
    return r.dump()


def b4():
    """하이브리드: B2 soft (슬롯 캐리지, 직선 직접 구동) + B3 텐던 hard. 가운데 벽 없음."""
    c, d = load("common"), load("B4")
    r = Report(d, c)
    so = d["soft"]
    o = c["objects"]
    z_top = c["board_t"] * c["palm_layers"]
    x_min = d["hard"]["width"] / 2 + c["margin_plan"]
    r.put("soft_x_min", x_min)
    Rs = -so["slot_z"] + so["root_len"] + c["finray"]["L"]
    r.put("soft_reach", Rs)
    r.check("S1", "건전지 끝(25) ≥ 스토퍼 x_min", o["battery"]["len"] / 2, lo=x_min, unit="mm")
    r.check("S2", "스펀지 반폭 ≤ 개방 x_open", o["sponge"]["sx"] / 2, hi=so["x_open"], unit="mm")
    r.check("S4", "soft 슬롯(핀 u+10) + 여유 3 이 손바닥 반폭 안", so["x_open"] + 13, hi=d["palm"]["sx"] / 2, unit="mm")
    r.check("S5", "soft 가이드 벽(y=±wall_y)이 텐던 손가락 피벗보다 안쪽 (벽이 hard 경로를 막지 않음: 손가락 |x|<w/2, 벽 x≥x_min-2)",
            x_min - 2, lo=d["hard"]["width"] / 2, unit="mm")
    T = c["force"]["chip_limit_N"]
    r.put("soft_string_T_at_limit_N", T)
    r.put("soft_pull_mm", so["x_open"] - x_min)
    hard_tendon(r, z_top, -Rs, -Rs)
    return r.dump()


def b5(name="B5"):
    """평행사변형 hard. 손끝판(coupler)은 항상 수직 → 쐐기 0°, 평행 pinch.
    피벗 y 를 '건전지 pinch 에서 링크 수직' 으로 두면 pinch = 손끝 궤적 최저점 → 닫히는 도중 바닥 파고듦 없음."""
    c, d = load("common"), load(name)
    r = Report(d, c)
    h = d["hard"]
    s = soft_flap(r, h["width"])
    z_top = s["z_top"]
    o = c["objects"]
    half_t = h["plies"] * c["board_t"] / 2
    face = half_t + c["pad_t"]
    L, dd = h["L"], h["d"]
    yp = o["battery"]["d"] / 2 + face  # 링크 수직일 때 패드면 y = 건전지 반지름
    r.put("hard_pivot_y", yp)
    zP = -h["bracket_drop"]  # 두 피벗 높이 (손바닥 아랫면 아래), P_in y=yp, P_out y=yp+d
    psi = sp.symbols("psi", real=True)
    # 안쪽 링크 끝 E_in = P_in + L(sinψ, -cosψ); 손끝판은 E_in 에서 아래로 Lc (Lc 는 아래에서 결정)
    Lc = sp.symbols("Lc", positive=True)
    tip_z = zP - L * sp.cos(psi) - Lc
    face_y = yp + L * sp.sin(psi) - face
    # Fin Ray 창 가운데(6.5)에 오도록 Lc 결정: Rigid 높이 H = -tip_z(0)
    soft_tip_batt = s["tip_z"].subs(s["phi"], s["phi_b"])
    lo, hi = c["finray_window"]
    Lc_val = sp.solve(sp.Eq(soft_tip_batt - tip_z.subs(psi, 0), (lo + hi) / 2), Lc)[0]
    r.put("hard_coupler_below_E", Lc_val)
    tip_z = tip_z.subs(Lc, Lc_val)
    z_floor = tip_z.subs(psi, 0)
    r.put("rigid_palm_height", -z_floor)
    finray_window(r, soft_tip_batt, z_floor)
    # 물체별 ψ
    for name, rad in (("cable", o["cable"]["d"] / 2), ("cap", o["cap"]["d"] / 2)):
        pv = sp.nsolve(face_y - rad, psi, 0.05)
        r.put(f"hard_psi_{name}_deg", pv / deg)
        r.put(f"hard_tip_rise_{name}_mm", tip_z.subs(psi, pv) - z_floor)
    psi_min = sp.nsolve(face_y, psi, -0.1)
    r.put("hard_psi_min_deg", psi_min / deg)
    r.check("H2", "케이블 Ø5 각이 손끝 맞닿음 각보다 열린 쪽", sp.nsolve(face_y - o["cable"]["d"] / 2, psi, 0) / deg, lo=psi_min / deg, unit="deg")
    rise_cable = tip_z.subs(psi, sp.nsolve(face_y - o["cable"]["d"] / 2, psi, 0)) - z_floor
    r.check("H4", "케이블 파지 시 손톱 끝이 케이블 반지름보다 아래 (pinch 각에서 손끝 상승 ≤ 2.5 mm)", rise_cable, hi=o["cable"]["d"] / 2, unit="mm")
    # 열림: 손끝 상승 → Soft 모드 간섭
    psi_open = h["psi_open_deg"] * deg
    soft_tip_chip = s["tip_z"].subs(s["phi"], s["phi_c"])
    gap = tip_z.subs(psi, psi_open) - soft_tip_chip
    r.put("soft_mode_hard_above_finray", gap)
    r.check("R1", "Soft 모드: 열린 hard 손끝판이 Fin Ray 끝보다 ≥10 위", gap, lo=c["margin_soft"], unit="mm")
    # 개구
    Y = 2 * (yp + L * sp.sin(psi_open) - face)
    r.put("hard_opening_mm", Y)
    # 링크 끼리 / 바닥 / 드럼
    r.check("H5", "바깥 피벗 드럼이 안쪽 피벗 축을 안 건드림 (r ≤ d - 4)", h["drum_r"], hi=dd - 4, unit="mm")
    r.check("H5b", "앞·뒤 드럼 안 겹침 (2·(yp + d - r) ≥ 3)", 2 * (yp + dd - h["drum_r"]), lo=3, unit="mm")
    r.check("H6", "드럼 윗면이 손바닥 아랫면보다 아래 (bracket_drop ≥ r + 2)", h["bracket_drop"], lo=h["drum_r"] + 2, unit="mm")
    # 두 링크는 평행, 수직 거리 = d·cosψ. 완전 개방에서 가장 가까움 (1차 시도: 피벗을 위·아래로 쌓아 수직일 때 겹침 → 수평 배치로 변경)
    r.check("H7", "완전 개방에서 두 링크 수직 거리 d·cos(ψ_open) ≥ 링크두께 + 2", dd * sp.cos(h["psi_open_deg"] * deg), lo=h["link_plies"] * c["board_t"] + 2, unit="mm")
    r.check("H9", "안쪽 링크 갈래 사이 간격(12)이 드럼 두께(9)+여유 3 이상 — d·cosψ_open < r 라 일체형 링크는 드럼과 간섭",
            12, lo=9 + 3, unit="mm")
    # H10 (시뮬에서 발견): 브래킷(x = w/2+1 ~ w/2+4)과 soft 드럼 아래 절반(x ≥ 손바닥 반폭 - r_s) 이 겹침
    r.check("H10", "soft 드럼 안쪽 끝 x ≥ hard 브래킷 바깥 x + 1", d["palm"]["sx"] / 2 - d["soft"]["drum_r"], lo=h["width"] / 2 + 4 + 1, unit="mm")
    r.check("H8", "바깥 피벗이 손바닥 안 (yp + d + 6 ≤ sy/2)", yp + dd + 6, hi=d["palm"]["sy"] / 2, unit="mm")
    # 장력: 손끝판 수평력 F → 링크 토크 F·L·cosψ (ψ=0 최대) → T = F L / r
    T = c["force"]["pinch_target_N"] * L / h["drum_r"]
    r.put("hard_string_T_N", T)
    r.check("H1", "pinch 8 N 에서 텐던 장력 ≤ 45 N (연속 루프 1가닥, 두 손가락 몫 각각)", T, hi=45, unit="N")
    r.put("hard_pull_mm", h["drum_r"] * (psi_open - psi_min))
    r.put("hard_face_wedge_deg", 0)
    comp = h.get("compliance")
    V_REQ = 10.0  # 목표 수직 순응 (팔 높이 오차 가정 ±10 mm)
    if comp is None:
        # 기본 B5: 손톱 플랩(5 mm) 만 — 접힘으로 얻는 최대 상승
        rise = h["nail_len"] * (1 - sp.cos(85 * deg))
        r.put("vertical_compliance_mm", rise)
    elif comp["type"] == "tip":
        # 손끝판 피벗 = E_in 아래 4.5 (커플러 바 밑). 손톱 끝 = 피벗에서 (안쪽 -halfT, 아래 -Lp)
        Lp = Lc_val - 4.5
        th = sp.symbols("th", real=True)
        # 바닥 힘(위 방향)의 모멘트 vs pinch 반력(바깥 방향, 패드 가운데 높이)의 모멘트 → 부호가 반대여야 스토퍼로 분리
        M_floor = (-half_t) * 1  # r_y * N
        M_pinch = (Lp / 2) * 1  # -r_z * F
        r.check("C1", "바닥 힘과 pinch 반력이 손끝판을 반대로 돌림 (M_floor·M_pinch < 0 → pinch 는 스토퍼, 바닥은 꺾임)", M_floor * M_pinch, hi=-1e-9)
        # 각 th 로 꺾일 때 (바닥이 미는 방향 = 아래쪽 끝이 안쪽·위로) 손톱 끝 상승과 안쪽 이동
        ty0, tz0 = -half_t, -Lp
        ty = ty0 * sp.cos(th) + tz0 * sp.sin(th)
        tz = ty0 * sp.sin(th) * -1 + tz0 * sp.cos(th)
        rise = (tz - tz0)
        th10 = sp.nsolve(rise - V_REQ, th, 0.5)
        r.put("tip_theta_for_10mm_deg", th10 / deg)
        r.put("tip_inward_shift_at_10mm", -(ty.subs(th, th10) - ty0))
        r.check("C2", "10 mm 상승에 필요한 손끝판 꺾임각 ≤ θ_max", th10 / deg, hi=comp["theta_max_deg"], unit="deg")
        # C3 (시뮬에서 발견): 바닥 힘이 손끝을 '안쪽(물체 쪽)' 으로 돌리면, 물체를 쥐고 있을 때 물체가 막아 순응이 안 됨.
        #   반대로 돌게 하면 pinch 반력과 같은 방향이라 스토퍼로 분리 불가 (C1 실패) → 손끝판 관절은 구조적으로 성립 안 함.
        r.check("C3", "10 mm 순응 시 손끝 안쪽 이동 ≤ 2 mm (물체 쪽으로 파고들지 않음)", -(ty.subs(th, th10) - ty0), hi=2, unit="mm")
        r.put("vertical_compliance_mm", rise.subs(th, comp["theta_max_deg"] * deg))
        # 고무줄: 바닥 3 N 에서 꺾이기 시작(프리로드 모멘트 = N·팔), 10 mm 에서 6 N
        arm0 = half_t
        M0 = comp["engage_N"] * arm0
        r.put("tip_preload_Nmm", M0)
        r.put("tip_rubber_k_Nmm_per_rad", (comp["force_at_travel_N"] * arm0 - M0) / th10)
    elif comp["type"] == "float":
        r.check("C1", "텔레스코프 이동 범위 ≥ 10 mm + 여유 2", comp["travel"], lo=V_REQ + 2, unit="mm")
        r.check("C2", "슬리브(굵은 빨대) 길이 ≥ 2 × 이동 (빠지지 않고 덜 기울게)", comp["sleeve_len"], lo=2 * comp["travel"], unit="mm")
        # pinch 반력 8 N 이 손끝(아래 ~H)에 → 슬리브 2개 간격 s 에서 우력. 마찰 μ0.4 로 생기는 수직 저항이 프리로드보다 작아야 수직 순응 유지
        H_arm = -z_floor - 0
        s_gap = h["d"] + 12
        Fn = c["force"]["pinch_target_N"] * H_arm / s_gap
        r.put("float_sleeve_normal_N", Fn)
        r.put("float_friction_N_mu0.4", 0.4 * Fn)
        # (처음엔 '쥔 채로도 수직 순응' 을 요구해 실패로 판정했으나, 순응은 접근 중에만 필요하고 쥔 뒤 마찰로 잠기는 건
        #  들어올릴 때 손가락이 처지지 않는 장점 → 정보값으로만 기록)
        r.put("float_locks_when_gripping", 1 if 2 * 0.4 * Fn > comp["engage_N"] else 0)
        r.put("vertical_compliance_mm", comp["travel"])
        r.put("float_k_N_per_mm", (comp["force_at_travel_N"] - comp["engage_N"]) / V_REQ)
    elif comp["type"] == "nail":
        rise = comp["nail_len"] * (1 - sp.cos(comp["fold_max_deg"] * deg))
        r.put("vertical_compliance_mm", rise)
        r.check("C1", "손톱이 접히며 얻는 상승 ≥ 10 mm", rise, lo=V_REQ, unit="mm")
        r.check("C2", "손톱(강성 쪽: 안쪽 스토퍼)이 건전지 적도 높이(7)를 덮음 → 접히기 전엔 손톱 안쪽 면이 쥐는 면", comp["nail_len"], lo=o["battery"]["d"] / 2, unit="mm")
    return r.dump()


def main():
    res = [b1(), b2(), b3(), b3o(), b4(), b5(), b5("B5T"), b5("B5F"), b5("B5N")]
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
