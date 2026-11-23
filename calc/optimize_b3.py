"""B3 텐던 hard + flap soft 치수 최적화.

탐색 과정에서 드러난 것 (2번 실패 → 정식화 수정):
  1) '자유 닫힘 경로 중 바닥 아래로 안 내려감' 은 불가능: 원위지골이 수직을 지날 때 손톱이 가장 낮다.
  2) 'pinch = 경로 최저점' 도 불가능: 최저점은 피벗 바로 아래(y≈44)라 건전지(y≈7)까지 못 들어옴.
  → 손톱은 바닥에 먼저 닿고 '바닥을 따라 미끄러져' 들어와야 한다. 이때 원위지골이 수직을 '넘어야' 하면 걸린다(jam).
     따라서 jam-free 조건 = 목표 pinch 의 원위각 td ≥ 0 (수직 또는 약간 바깥) + 바닥 위 미끄럼 구간에서
     텐던을 당길수록 손톱이 안쪽으로 오는 방향일 것 (텐던 길이 감소량 r1θ1 + r2θ2 이 y 와 같은 방향으로 단조).
     덤: 원위지골이 수직이면 진짜 평행 pinch (쐐기 0°).
  3) 평행 pinch 는 근위가 안쪽(θ1<0)이라 원위가 근위 대비 바깥(θ2>0)이어야 함 → 굽힘 전용 텐던은 휴지각 θ2_rest>0
     (스토퍼로 원위를 바깥으로 젖혀 둔 손가락)에서 출발해야 도달 가능.

설계변수: l1, l2(손톱 포함), r1, r2, θ1_rest, θ2_rest(원위 휴지각: 스토퍼가 바깥으로 젖혀 둠), c(=Δθ2/Δθ1, k2/k1 = (r2/r1)/c), td, Fin Ray 뿌리 root_len.
제약: P(손톱 y=9 에서 pinch), R2 [3,10], R1 ≥ 10, 0.3 ≤ k2/k1 ≤ 3, T = F·l2/r2 ≤ 35, Y ≥ 150,
      G(바닥 첫 접촉이 pinch 바깥 & 원위각 ≥ td & 미끄럼 구간 단조), 관절 한계.
목적: 장력 ↓, 손가락 총길이 ↓, R2 를 창 가운데(6.5)로.
"""
import json
import numpy as np
import sympy as sp

rng = np.random.default_rng(7)
c_ = json.load(open("params/common.json"))
b3 = json.load(open("params/B3.json"))
zt = c_["board_t"] * c_["palm_layers"]
half_t = b3["hard"]["plies"] * c_["board_t"] / 2
face = half_t + c_["pad_t"]
yp = b3["palm"]["sy"] / 2 + half_t
xh = b3["palm"]["sx"] / 2
L = c_["finray"]["L"]
F = c_["force"]["pinch_target_N"]
TY = b3["hard"]["target_tip_y"]
d2r = np.pi / 180
K1_SPEC = 40.0  # N·mm/rad, 근위 복원 고무줄 (휴지 자세 유지 + 재개방에 충분한 하한 근처)
FT_MIN = 1.0  # N, 골판지-바닥 마찰 대비 안쪽 구동력 최소


def evaluate(l1, l2, r1, r2, t10, t20, cc, td, root):
    n = l1.shape[0]
    Rs = root + L
    phib = np.arcsin((c_["objects"]["battery"]["len"] / 2 - xh) / Rs)
    soft_tip = zt - Rs * np.cos(phib)
    s1 = (TY - yp - l2 * np.sin(td)) / l1
    okp = np.abs(s1) < 0.999
    t1p = np.arcsin(np.clip(s1, -1, 1))
    t2p = td - t1p
    zf = zt - l1 * np.cos(t1p) - l2 * np.cos(td)
    # 자유 경로 (공중): θ1 = θ10 - s, θ2 = -c s → 처음 바닥에 닿는 s0
    S = np.linspace(0, 100 * d2r, 401)[:, None]
    th1 = t10 - S
    th12 = th1 + t20 - cc * S
    tz = zt - l1 * np.cos(th1) - l2 * np.cos(th12)
    ty = yp + l1 * np.sin(th1) + l2 * np.sin(th12)
    below = tz <= zf
    has = below.any(axis=0)
    k0 = np.where(has, below.argmax(axis=0), 0)
    cols = np.arange(n)
    y0 = ty[k0, cols]
    th1_0 = th1[k0, cols]
    th12_0 = th12[k0, cols]
    touch_ok = has & (y0 >= TY + 2) & (th12_0 >= td) & (th1_0 >= t1p)
    # 바닥 위 미끄럼: θ1 ∈ [t1p, θ1_0], 손톱 z = zf 유지 → θ12 = +acos(v) (수직 바깥 가지, td ≥ 0)
    U = np.linspace(0, 1, 41)[:, None]
    a1 = t1p + U * (th1_0 - t1p)
    v = (zt - l1 * np.cos(a1) - zf) / l2
    vok = (np.abs(v) <= 1).all(axis=0)
    a12 = np.arccos(np.clip(v, -1, 1))
    a2 = a12 - a1
    yy = yp + l1 * np.sin(a1) + l2 * np.sin(a12)
    ex = r1 * a1 + r2 * a2  # 텐던이 당겨질수록 감소
    mono = (np.diff(ex, axis=0) > 0).all(axis=0) & (np.diff(yy, axis=0) > 0).all(axis=0)
    # 구동력 여유 (4번째 시도에서 추가): 방향만 맞고 크기가 ~0 이면 마찰로 멈춘다.
    # 바닥 위 1자유도 에너지 E(θ1) 를 손톱 y 로 미분한 안쪽 구동력 ≥ FT_MIN (k1 = K1_SPEC, T = T_max)
    k1s = K1_SPEC
    k2s = k1s * (r2 / r1) / cc
    Tm = F * l2 / r2
    Ee = 0.5 * k1s * (a1 - t10) ** 2 + 0.5 * k2s * (a2 - t20) ** 2 + Tm * (r1 * a1 + r2 * a2)
    with np.errstate(divide="ignore", invalid="ignore"):
        Ft = np.diff(Ee, axis=0) / np.diff(yy, axis=0)  # dE/dy > 0 → y 감소(안쪽)로 E 감소
    ftmin = np.nan_to_num(Ft, nan=-1).min(axis=0)
    mono = mono & (ftmin >= FT_MIN)
    limits = (a1.min(axis=0) >= -45 * d2r) & (a2.min(axis=0) >= -90 * d2r) & (a2.max(axis=0) <= t20 + 0.5 * d2r)
    R2 = soft_tip - zf
    R1 = (zt - l1 * np.cos(t10) - l2 * np.cos(t10 + t20)) - soft_tip
    k21 = (r2 / r1) / cc
    T = F * l2 / r2
    Y = 2 * (yp + l1 * np.sin(t10) + l2 * np.sin(t10 + t20) - face)
    feas = okp & touch_ok & vok & mono & limits & (R2 >= 3) & (R2 <= 10) & (R1 >= 10) & (k21 >= 0.3) & (k21 <= 3) & (T <= 35) & (Y >= 150)
    stats = dict(okp=okp, touch=touch_ok, slide=vok & mono, limits=limits, R2=(R2 >= 3) & (R2 <= 10), R1=R1 >= 10,
                 k21=(k21 >= 0.3) & (k21 <= 3), T=T <= 35, Y=Y >= 150)
    return dict(feas=feas, stats=stats, ftmin=ftmin, R2=R2, R1=R1, k21=k21, T=T, Y=Y, y0=y0, zf=zf, t1p=t1p, t2p=t2p, th1_0=th1_0, th12_0=th12_0)


N = 300_000
X = dict(l1=rng.uniform(40, 85, N), l2=rng.uniform(25, 60, N), r1=rng.uniform(6, 14, N), r2=rng.uniform(8, 14, N),
         t10=rng.uniform(15, 55, N) * d2r, t20=rng.uniform(0, 60, N) * d2r, cc=rng.uniform(0.2, 3.0, N), td=rng.uniform(0, 15, N) * d2r, root=rng.uniform(5, 35, N))
E = evaluate(**X)
print("feasible:", int(E["feas"].sum()), "/", N, {k: int(v.sum()) for k, v in E["stats"].items()})
cost = E["T"] / 35 + 0.6 * (X["l1"] + X["l2"]) / 115 + 0.1 * np.abs(E["R2"] - 6.5) / 3.5
cost[~E["feas"]] = np.inf
order = np.argsort(cost)
ang = {"t10", "t20", "td"}
best = None
for i in order[:200]:
    if not np.isfinite(cost[i]):
        break
    cand = {k: (round(float(v[i] / d2r)) if k in ang else round(float(v[i]) * 20) / 20 if k == "cc" else round(float(v[i]))) for k, v in X.items()}
    arr = {k: np.array([cand[k] * d2r if k in ang else cand[k]], dtype=float) for k in cand}
    e = evaluate(**arr)
    if e["feas"][0]:
        best = (cand, {k: float(v[0]) for k, v in e.items() if k not in ("feas", "stats")})
        break
if best is None:
    raise SystemExit("반올림 후 실현 가능한 후보 없음")
cand, e = best
cand["nail"] = int(np.ceil(face * np.tan(max(e["th12_0"], 0)) + 2))
print("채택:", cand)
print({k: round(v, 2) for k, v in e.items()})

# SymPy 검증: pinch 자세(닫힌 해) + 미끄럼 구간의 텐던 길이 단조성(도함수 부호)을 기호적으로
t1, = sp.symbols("t1", real=True),
l1, l2, r1, r2 = cand["l1"], cand["l2"], cand["r1"], cand["r2"]
td = sp.Rational(cand["td"]) * sp.pi / 180
T1p = sp.asin((TY - yp - l2 * sp.sin(td)) / l1)
zf = zt - l1 * sp.cos(T1p) - l2 * sp.cos(td)
th12 = sp.acos((zt - l1 * sp.cos(t1) - zf) / l2)
excursion = r1 * t1 + r2 * (th12 - t1)
dex = sp.diff(excursion, t1)
grid = [float(T1p) + k * (e["th1_0"] - float(T1p)) / 60 for k in range(0, 61)]  # 바닥 미끄럼 구간: pinch → 첫 접촉
signs = []
for g in grid:
    v = (zt - l1 * np.cos(g) - float(zf)) / l2
    if abs(v) < 1:
        signs.append(float(dex.subs(t1, g)))
res = dict(theta1_pinch_deg=float(T1p * 180 / sp.pi), theta2_pinch_deg=float((td - T1p) * 180 / sp.pi),
           palm_height=float(-zf), dex_min=min(signs), dex_max=max(signs))
print("SymPy:", {k: round(v, 3) for k, v in res.items()}, "(dex>0 이면 미끄럼 내내 텐던이 당겨질수록 손톱이 안쪽으로)")
json.dump({"params": cand, "numeric": e, "sympy": res}, open("calc/out/b3_opt_best.json", "w"), indent=2, ensure_ascii=False)
