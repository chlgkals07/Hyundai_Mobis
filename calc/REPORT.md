# SymPy 검증 리포트

`python3 calc/run_all.py` 로 재생성. 단위 mm / deg / N.

## B1 회전 — 플랩(score 힌지) + 단일 피벗  —  PASS

| ID | 조건 | 값 | 범위 | 결과 |
|---|---|---|---|---|
| S1 | 건전지 끝 접촉각이 스토퍼보다 열린 쪽 (스토퍼가 건전지 지지를 막지 않음) | -2.838 deg | [-6.824, ] | ✅ |
| S2 | 스펀지 폭이 개방 범위 안 | 2.838 deg | [, 90.0] | ✅ |
| S3 | 칩 한계력에서 실 A 장력 (손으로 당길 만한가, ≤ 40 N) | 33.667 N | [, 40.0] | ✅ |
| R2 | Rigid(건전지): Fin Ray 끝이 바닥 위 [3,10] mm — 걸리지 않으면서 건전지 옆면에 닿음 | 6.3 mm | [3.0, 10.0] | ✅ |
| R1 | Soft 모드: 열린 hard 손끝이 Fin Ray 끝보다 위 (≥ margin_soft) | 15.079 mm | [10.0, ] | ✅ |
| H1 | pinch 8 N 에서 실 B 장력 ≤ 40 N | 35.84 N | [, 40.0] | ✅ |
| H2 | 케이블(Ø5) 각이 손끝 맞닿음 각보다 열린 쪽 (케이블 쥘 수 있음) | -18.664 deg | [-20.048, ] | ✅ |

<details><summary>도출 치수</summary>

| 항목 | 값 |
|---|---|
| `soft_hinge_x` | 30.0 |
| `soft_reach` | 101.0 |
| `soft_phi_min_deg` | -6.8235 |
| `soft_x_min` | 18.0 |
| `soft_phi_battery_deg` | -2.8376 |
| `soft_phi_chip_deg` | -2.8376 |
| `soft_phi_sponge_deg` | 2.8376 |
| `soft_open_half_width` | 131.0 |
| `soft_pull_mm` | 25.3483 |
| `soft_string_T_at_limit_N` | 33.6667 |
| `hard_psi_battery_deg` | -16.8773 |
| `hard_psi_cable_deg` | -18.6639 |
| `hard_psi_min_deg` | -20.0477 |
| `hard_face_wedge_deg` | 16.8773 |
| `hard_psi_cable_tangent_deg` | -18.6656 |
| `rigid_palm_height_cable` | 100.1091 |
| `rigid_palm_height` | 101.176 |
| `rigid_finray_tip_above_floor` | 6.2999 |
| `soft_mode_hard_above_finray` | 15.0792 |
| `hard_psi_open_min_deg` | 35.7676 |
| `hard_pull_mm` | 26.2007 |
| `hard_string_T_N` | 35.84 |
| `plan_hard_half_width` | 14.0 |

</details>

## B2 직선 — 슬롯 가이드(빨대 핀) 캐리지  —  PASS

| ID | 조건 | 값 | 범위 | 결과 |
|---|---|---|---|---|
| S1 | 건전지 끝(25) ≥ 스토퍼 x_min | 25.0 mm | [18.0, ] | ✅ |
| S2 | 스펀지 반폭 ≤ 개방 x_open | 35.0 mm | [, 45.0] | ✅ |
| S3 | 칩 한계력에서 실 A 장력 ≤ 40 N (마찰 제외) | 5.0 N | [, 40.0] | ✅ |
| S4 | soft 슬롯(핀 u+10) + 여유 3 이 손바닥 반폭 안 | 58.0 mm | [, 60.0] | ✅ |
| R2 | Rigid(건전지): Fin Ray 끝이 바닥 위 [3,10] mm — 걸리지 않으면서 건전지 옆면에 닿음 | 4.454 mm | [3.0, 10.0] | ✅ |
| R1 | Soft 모드: 열린 hard 손끝이 Fin Ray 끝보다 위 (≥ margin_soft) | 12.0 mm | [10.0, ] | ✅ |
| H2 | hard 슬롯 경로가 손바닥 반깊이 안 | 51.5 mm | [, 52.0] | ✅ |
| H1 | pinch 8 N 에서 실 B 장력 ≤ 40 N (마찰 제외) | 9.238 N | [, 40.0] | ✅ |

<details><summary>도출 치수</summary>

| 항목 | 값 |
|---|---|
| `soft_x_min` | 18.0 |
| `soft_reach` | 105.0 |
| `soft_pull_mm` | 27.0 |
| `soft_string_T_at_limit_N` | 5.0 |
| `rigid_palm_height` | 109.4545 |
| `hard_drop_battery` | 16.4545 |
| `rigid_finray_tip_above_floor` | 4.4545 |
| `soft_mode_hard_above_finray` | 12.0 |
| `hard_reach_open_feasible` | [91.5, 95.0] |
| `hard_pull_mm` | 38.1051 |
| `hard_string_T_N` | 9.2376 |
| `hard_face_wedge_deg` | 0.0 |

</details>

## B3 말림 — 빨대축 플랩 + 2마디 텐던 손가락  —  PASS

| ID | 조건 | 값 | 범위 | 결과 |
|---|---|---|---|---|
| S1 | 건전지 끝 접촉각이 스토퍼보다 열린 쪽 (스토퍼가 건전지 지지를 막지 않음) | -2.838 deg | [-6.824, ] | ✅ |
| S2 | 스펀지 폭이 개방 범위 안 | 2.838 deg | [, 90.0] | ✅ |
| S3 | 칩 한계력에서 실 A 장력 (손으로 당길 만한가, ≤ 40 N) | 33.667 N | [, 40.0] | ✅ |
| H3 | 원위 관절 스프링이 근위보다 강하지 않아도 됨 (0.2 ≤ k2/k1 ≤ 5, 고무줄로 구현 가능) | 1.905  | [0.2, 5.0] | ✅ |
| R2 | Rigid(건전지): Fin Ray 끝이 바닥 위 [3,10] mm — 걸리지 않으면서 건전지 옆면에 닿음 | 6.571 mm | [3.0, 10.0] | ✅ |
| R1 | Soft 모드: 펴진(휴지) hard 손끝이 Fin Ray 끝보다 위 (≥ margin_soft) | 12.781 mm | [10.0, ] | ✅ |
| H1 | pinch 8 N 에서 텐던 장력 ≤ 60 N (원위 관절 기준 하한) | 50.0 N | [, 60.0] | ✅ |

<details><summary>도출 치수</summary>

| 항목 | 값 |
|---|---|
| `soft_hinge_x` | 30.0 |
| `soft_reach` | 101.0 |
| `soft_phi_min_deg` | -6.8235 |
| `soft_x_min` | 18.0 |
| `soft_phi_battery_deg` | -2.8376 |
| `soft_phi_chip_deg` | -2.8376 |
| `soft_phi_sponge_deg` | 2.8376 |
| `soft_open_half_width` | 131.0 |
| `soft_pull_mm` | 25.3483 |
| `soft_string_T_at_limit_N` | 33.6667 |
| `hard_theta1_pinch_deg` | -9.2962 |
| `hard_theta2_pinch_deg` | -20.7038 |
| `tendon_path_ratio` | 0.42 |
| `tendon_k2_over_k1` | 1.9048 |
| `rigid_palm_height` | 101.4476 |
| `rigid_finray_tip_above_floor` | 6.5714 |
| `soft_mode_hard_above_finray` | 12.7811 |
| `hard_pull_mm` | 11.4946 |
| `hard_string_T_N` | 50.0 |
| `hard_face_wedge_deg` | 30.0 |

</details>

## B3o 말림 최적화 — 젖힌 원위 + 바닥 미끄럼 평행 pinch  —  PASS

| ID | 조건 | 값 | 범위 | 결과 |
|---|---|---|---|---|
| S1 | 건전지 끝 접촉각이 스토퍼보다 열린 쪽 (스토퍼가 건전지 지지를 막지 않음) | -3.082 deg | [-7.414, ] | ✅ |
| S2 | 스펀지 폭이 개방 범위 안 | 3.082 deg | [, 90.0] | ✅ |
| S3 | 칩 한계력에서 실 A 장력 (손으로 당길 만한가, ≤ 40 N) | 31.0 N | [, 40.0] | ✅ |
| H3 | 원위 관절 스프링이 근위보다 강하지 않아도 됨 (0.2 ≤ k2/k1 ≤ 5, 고무줄로 구현 가능) | 2.198  | [0.2, 5.0] | ✅ |
| R2 | Rigid(건전지): Fin Ray 끝이 바닥 위 [3,10] mm — 걸리지 않으면서 건전지 옆면에 닿음 | 6.335 mm | [3.0, 10.0] | ✅ |
| R1 | Soft 모드: 펴진(휴지) hard 손끝이 Fin Ray 끝보다 위 (≥ margin_soft) | 12.084 mm | [10.0, ] | ✅ |
| H1 | pinch 8 N 에서 텐던 장력 ≤ 60 N (원위 관절 기준 하한) | 28.0 N | [, 60.0] | ✅ |
| J1 | 공중 닫힘 경로의 첫 바닥 접촉이 pinch 보다 바깥 (y0 - pinch y ≥ 2) | 54.312 mm | [2.0, ] | ✅ |
| J2 | 바닥 미끄럼 구간 내내 텐던을 당길수록 손톱이 안쪽 (d(r1θ1+r2θ2)/dθ1 > 0, 최소값) | 5.481  | [0.0, ] | ✅ |
| J4 | 손톱 길이 ≥ (반두께+패드)·tan(접촉 시 원위각) + 1 — 패드 모서리가 바닥을 긁지 않음 | 9.0 mm | [7.646, ] | ✅ |
| J5 | k1=40 N·mm/rad 고무줄로 바닥 미끄럼 안쪽 구동력 최소 ≥ 1 N | 1.904 N | [1.0, ] | ✅ |
| J3 | 설계 k1 이 상한 이하 & 휴지 유지 하한(20) 이상 | 40.0 N·mm/rad | [20.0, 203.356] | ✅ |
| J3b | k1 상한이 고무줄로 구현 가능한 범위 (≥ 20 N·mm/rad: 너무 약하면 휴지 자세 유지 못함) | 203.356 N·mm/rad | [20.0, ] | ✅ |

<details><summary>도출 치수</summary>

| 항목 | 값 |
|---|---|
| `soft_hinge_x` | 30.0 |
| `soft_reach` | 93.0 |
| `soft_phi_min_deg` | -7.4137 |
| `soft_x_min` | 18.0 |
| `soft_phi_battery_deg` | -3.0819 |
| `soft_phi_chip_deg` | -3.0819 |
| `soft_phi_sponge_deg` | 3.0819 |
| `soft_open_half_width` | 123.0 |
| `soft_pull_mm` | 25.5028 |
| `soft_string_T_at_limit_N` | 31.0 |
| `hard_theta1_pinch_deg` | -30.931 |
| `hard_theta2_pinch_deg` | 35.931 |
| `tendon_path_ratio` | 0.35 |
| `tendon_k2_over_k1` | 2.1978 |
| `rigid_palm_height` | 93.2008 |
| `rigid_finray_tip_above_floor` | 6.3353 |
| `soft_mode_hard_above_finray` | 12.084 |
| `hard_pull_mm` | 14.727 |
| `hard_string_T_N` | 28.0 |
| `hard_face_wedge_deg` | -5.0 |
| `slide_dex_min` | 5.4807 |
| `slide_g_max_rad_per_mm` | 0.0826 |
| `tendon_k1_max_Nmm_per_rad` | 203.3556 |
| `tendon_k2_max_Nmm_per_rad` | 446.9353 |
| `J1_rubber_moment_at_pinch_Nmm` | 170.118 |
| `touchdown_distal_deg` | 45.6375 |
| `slide_drive_min_N` | 1.9043 |

</details>

## B4 하이브리드 — 슬롯 캐리지 soft + 텐던 hard  —  PASS

| ID | 조건 | 값 | 범위 | 결과 |
|---|---|---|---|---|
| S1 | 건전지 끝(25) ≥ 스토퍼 x_min | 25.0 mm | [18.0, ] | ✅ |
| S2 | 스펀지 반폭 ≤ 개방 x_open | 35.0 mm | [, 45.0] | ✅ |
| S4 | soft 슬롯(핀 u+10) + 여유 3 이 손바닥 반폭 안 | 58.0 mm | [, 60.0] | ✅ |
| S5 | soft 가이드 벽(y=±wall_y)이 텐던 손가락 피벗보다 안쪽 (벽이 hard 경로를 막지 않음: 손가락 |x|<w/2, 벽 x≥x_min-2) | 16.0 mm | [14.0, ] | ✅ |
| H3 | 원위 관절 스프링이 근위보다 강하지 않아도 됨 (0.2 ≤ k2/k1 ≤ 5, 고무줄로 구현 가능) | 1.905  | [0.2, 5.0] | ✅ |
| R2 | Rigid(건전지): Fin Ray 끝이 바닥 위 [3,10] mm — 걸리지 않으면서 건전지 옆면에 닿음 | 4.448 mm | [3.0, 10.0] | ✅ |
| R1 | Soft 모드: 펴진(휴지) hard 손끝이 Fin Ray 끝보다 위 (≥ margin_soft) | 14.905 mm | [10.0, ] | ✅ |
| H1 | pinch 8 N 에서 텐던 장력 ≤ 60 N (원위 관절 기준 하한) | 50.0 N | [, 60.0] | ✅ |

<details><summary>도출 치수</summary>

| 항목 | 값 |
|---|---|
| `soft_x_min` | 18.0 |
| `soft_reach` | 97.0 |
| `soft_string_T_at_limit_N` | 5.0 |
| `soft_pull_mm` | 27.0 |
| `hard_theta1_pinch_deg` | -9.2962 |
| `hard_theta2_pinch_deg` | -20.7038 |
| `tendon_path_ratio` | 0.42 |
| `tendon_k2_over_k1` | 1.9048 |
| `rigid_palm_height` | 101.4476 |
| `rigid_finray_tip_above_floor` | 4.4476 |
| `soft_mode_hard_above_finray` | 14.9049 |
| `hard_pull_mm` | 11.4946 |
| `hard_string_T_N` | 50.0 |
| `hard_face_wedge_deg` | 30.0 |

</details>

## B5 평행 링크 — 플랩 Fin Ray + 평행사변형 hard (텐던 1가닥)  —  PASS

| ID | 조건 | 값 | 범위 | 결과 |
|---|---|---|---|---|
| S1 | 건전지 끝 접촉각이 스토퍼보다 열린 쪽 (스토퍼가 건전지 지지를 막지 않음) | -2.838 deg | [-7.968, ] | ✅ |
| S2 | 스펀지 폭이 개방 범위 안 | 2.838 deg | [, 90.0] | ✅ |
| S3 | 칩 한계력에서 실 A 장력 (손으로 당길 만한가, ≤ 40 N) | 38.846 N | [, 40.0] | ✅ |
| R2 | Rigid(건전지): Fin Ray 끝이 바닥 위 [3,10] mm — 걸리지 않으면서 건전지 옆면에 닿음 | 6.5 mm | [3.0, 10.0] | ✅ |
| H2 | 케이블 Ø5 각이 손끝 맞닿음 각보다 열린 쪽 | -4.693 deg | [-7.312, ] | ✅ |
| H4 | 케이블 파지 시 손톱 끝이 케이블 반지름보다 아래 (pinch 각에서 손끝 상승 ≤ 2.5 mm) | 0.184 mm | [, 2.5] | ✅ |
| R1 | Soft 모드: 열린 hard 손끝판이 Fin Ray 끝보다 ≥10 위 | 16.172 mm | [10.0, ] | ✅ |
| H5 | 바깥 피벗 드럼이 안쪽 피벗 축을 안 건드림 (r ≤ d - 4) | 16.0 mm | [, 20.0] | ✅ |
| H5b | 앞·뒤 드럼 안 겹침 (2·(yp + d - r) ≥ 3) | 43.0 mm | [3.0, ] | ✅ |
| H6 | 드럼 윗면이 손바닥 아랫면보다 아래 (bracket_drop ≥ r + 2) | 20.0 mm | [18.0, ] | ✅ |
| H7 | 완전 개방에서 두 링크 수직 거리 d·cos(ψ_open) ≥ 막대 높이 + 2 | 14.107 mm | [14.0, ] | ✅ |
| H9 | 안쪽 링크 갈래 사이 간격(12)이 드럼 두께(9)+여유 3 이상 — d·cosψ_open < r 라 일체형 링크는 드럼과 간섭 | 12.0 mm | [12.0, ] | ✅ |
| H10 | soft 드럼 안쪽 끝 x ≥ hard 브래킷 바깥 x + 1 | 17.0 mm | [17.0, ] | ✅ |
| S5 | 아랫장 측면 relief ≥ 손바닥 두께·tan|φ_min| (플랩이 −8° 까지 닫힐 공간) | 1.5 mm | [0.84, ] | ✅ |
| H11 | 열림 스토퍼 접촉점이 브래킷 안 (y ≤ 바깥 피벗 + 6) | 43.308 mm | [, 45.0] | ✅ |
| H12 | 링크 막대 바깥 면(4.5+막대두께) + 1 ≤ 브래킷 안쪽 면 (w/2+1) | 11.5 mm | [, 13.0] | ✅ |
| H8 | 바깥 피벗이 손바닥 안 (yp + d + 6 ≤ sy/2) | 43.5 mm | [, 44.0] | ✅ |
| H1 | pinch 8 N 에서 텐던 장력 ≤ 45 N (연속 루프 1가닥, 두 손가락 몫 각각) | 27.5 N | [, 45.0] | ✅ |

<details><summary>도출 치수</summary>

| 항목 | 값 |
|---|---|
| `soft_hinge_x` | 30.0 |
| `soft_reach` | 101.0 |
| `soft_phi_min_deg` | -7.9676 |
| `soft_x_min` | 16.0 |
| `soft_phi_battery_deg` | -2.8376 |
| `soft_phi_chip_deg` | -2.8376 |
| `soft_phi_sponge_deg` | 2.8376 |
| `soft_open_half_width` | 131.0 |
| `soft_pull_mm` | 22.2282 |
| `soft_string_T_at_limit_N` | 38.8462 |
| `hard_pivot_y` | 13.5 |
| `hard_coupler_below_E` | 26.3762 |
| `rigid_palm_height` | 101.3762 |
| `rigid_finray_tip_above_floor` | 6.5 |
| `hard_psi_cable_deg` | -4.6931 |
| `hard_tip_rise_cable_mm` | 0.1844 |
| `hard_psi_cap_deg` | 8.3636 |
| `hard_tip_rise_cap_mm` | 0.5849 |
| `hard_psi_min_deg` | -7.312 |
| `soft_mode_hard_above_finray` | 16.1718 |
| `hard_opening_mm` | 102.9919 |
| `soft_edge_interference_mm` | 0.8398 |
| `soft_stop_face_x` | 28.0405 |
| `hard_stop_tab_y` | 43.3084 |
| `hard_stop_tab_z` | -20.5119 |
| `hard_outer_bar_inner_gap` | 10.0 |
| `hard_string_T_N` | 27.5 |
| `hard_pull_mm` | 17.1215 |
| `hard_face_wedge_deg` | 0.0 |
| `vertical_compliance_mm` | 4.5642 |

</details>

## B5T 손끝판 관절 — 평행 링크 + 바닥 쪽으로만 꺾이는 손끝판  —  FAIL

| ID | 조건 | 값 | 범위 | 결과 |
|---|---|---|---|---|
| S1 | 건전지 끝 접촉각이 스토퍼보다 열린 쪽 (스토퍼가 건전지 지지를 막지 않음) | -2.838 deg | [-7.968, ] | ✅ |
| S2 | 스펀지 폭이 개방 범위 안 | 2.838 deg | [, 90.0] | ✅ |
| S3 | 칩 한계력에서 실 A 장력 (손으로 당길 만한가, ≤ 40 N) | 38.846 N | [, 40.0] | ✅ |
| R2 | Rigid(건전지): Fin Ray 끝이 바닥 위 [3,10] mm — 걸리지 않으면서 건전지 옆면에 닿음 | 6.5 mm | [3.0, 10.0] | ✅ |
| H2 | 케이블 Ø5 각이 손끝 맞닿음 각보다 열린 쪽 | -4.693 deg | [-7.312, ] | ✅ |
| H4 | 케이블 파지 시 손톱 끝이 케이블 반지름보다 아래 (pinch 각에서 손끝 상승 ≤ 2.5 mm) | 0.184 mm | [, 2.5] | ✅ |
| R1 | Soft 모드: 열린 hard 손끝판이 Fin Ray 끝보다 ≥10 위 | 16.172 mm | [10.0, ] | ✅ |
| H5 | 바깥 피벗 드럼이 안쪽 피벗 축을 안 건드림 (r ≤ d - 4) | 16.0 mm | [, 20.0] | ✅ |
| H5b | 앞·뒤 드럼 안 겹침 (2·(yp + d - r) ≥ 3) | 43.0 mm | [3.0, ] | ✅ |
| H6 | 드럼 윗면이 손바닥 아랫면보다 아래 (bracket_drop ≥ r + 2) | 20.0 mm | [18.0, ] | ✅ |
| H7 | 완전 개방에서 두 링크 수직 거리 d·cos(ψ_open) ≥ 막대 높이 + 2 | 14.107 mm | [14.0, ] | ✅ |
| H9 | 안쪽 링크 갈래 사이 간격(12)이 드럼 두께(9)+여유 3 이상 — d·cosψ_open < r 라 일체형 링크는 드럼과 간섭 | 12.0 mm | [12.0, ] | ✅ |
| H10 | soft 드럼 안쪽 끝 x ≥ hard 브래킷 바깥 x + 1 | 17.0 mm | [17.0, ] | ✅ |
| S5 | 아랫장 측면 relief ≥ 손바닥 두께·tan|φ_min| (플랩이 −8° 까지 닫힐 공간) | 1.5 mm | [0.84, ] | ✅ |
| H11 | 열림 스토퍼 접촉점이 브래킷 안 (y ≤ 바깥 피벗 + 6) | 43.308 mm | [, 45.0] | ✅ |
| H12 | 링크 막대 바깥 면(4.5+막대두께) + 1 ≤ 브래킷 안쪽 면 (w/2+1) | 11.5 mm | [, 13.0] | ✅ |
| H8 | 바깥 피벗이 손바닥 안 (yp + d + 6 ≤ sy/2) | 43.5 mm | [, 44.0] | ✅ |
| H1 | pinch 8 N 에서 텐던 장력 ≤ 45 N (연속 루프 1가닥, 두 손가락 몫 각각) | 27.5 N | [, 45.0] | ✅ |
| C1 | 바닥 힘과 pinch 반력이 손끝판을 반대로 돌림 (M_floor·M_pinch < 0 → pinch 는 스토퍼, 바닥은 꺾임) | -49.221  | [, -0.0] | ✅ |
| C2 | 10 mm 상승에 필요한 손끝판 꺾임각 ≤ θ_max | 46.253 deg | [, 50.0] | ✅ |
| C3 | 10 mm 순응 시 손끝 안쪽 이동 ≤ 2 mm (물체 쪽으로 파고들지 않음) | 14.415 mm | [, 2.0] | ❌ |

<details><summary>도출 치수</summary>

| 항목 | 값 |
|---|---|
| `soft_hinge_x` | 30.0 |
| `soft_reach` | 101.0 |
| `soft_phi_min_deg` | -7.9676 |
| `soft_x_min` | 16.0 |
| `soft_phi_battery_deg` | -2.8376 |
| `soft_phi_chip_deg` | -2.8376 |
| `soft_phi_sponge_deg` | 2.8376 |
| `soft_open_half_width` | 131.0 |
| `soft_pull_mm` | 22.2282 |
| `soft_string_T_at_limit_N` | 38.8462 |
| `hard_pivot_y` | 13.5 |
| `hard_coupler_below_E` | 26.3762 |
| `rigid_palm_height` | 101.3762 |
| `rigid_finray_tip_above_floor` | 6.5 |
| `hard_psi_cable_deg` | -4.6931 |
| `hard_tip_rise_cable_mm` | 0.1844 |
| `hard_psi_cap_deg` | 8.3636 |
| `hard_tip_rise_cap_mm` | 0.5849 |
| `hard_psi_min_deg` | -7.312 |
| `soft_mode_hard_above_finray` | 16.1718 |
| `hard_opening_mm` | 102.9919 |
| `soft_edge_interference_mm` | 0.8398 |
| `soft_stop_face_x` | 28.0405 |
| `hard_stop_tab_y` | 43.3084 |
| `hard_stop_tab_z` | -20.5119 |
| `hard_outer_bar_inner_gap` | 10.0 |
| `hard_string_T_N` | 27.5 |
| `hard_pull_mm` | 17.1215 |
| `hard_face_wedge_deg` | 0.0 |
| `tip_theta_for_10mm_deg` | 46.2526 |
| `tip_inward_shift_at_10mm` | 14.4149 |
| `vertical_compliance_mm` | 11.2616 |
| `tip_preload_Nmm` | 13.5 |
| `tip_rubber_k_Nmm_per_rad` | 16.7232 |

</details>

## B5F 플로팅 — 평행 링크 브래킷을 빨대 텔레스코프에 띄움  —  PASS

| ID | 조건 | 값 | 범위 | 결과 |
|---|---|---|---|---|
| S1 | 건전지 끝 접촉각이 스토퍼보다 열린 쪽 (스토퍼가 건전지 지지를 막지 않음) | -2.838 deg | [-7.968, ] | ✅ |
| S2 | 스펀지 폭이 개방 범위 안 | 2.838 deg | [, 90.0] | ✅ |
| S3 | 칩 한계력에서 실 A 장력 (손으로 당길 만한가, ≤ 40 N) | 38.846 N | [, 40.0] | ✅ |
| R2 | Rigid(건전지): Fin Ray 끝이 바닥 위 [3,10] mm — 걸리지 않으면서 건전지 옆면에 닿음 | 6.5 mm | [3.0, 10.0] | ✅ |
| H2 | 케이블 Ø5 각이 손끝 맞닿음 각보다 열린 쪽 | -4.693 deg | [-7.312, ] | ✅ |
| H4 | 케이블 파지 시 손톱 끝이 케이블 반지름보다 아래 (pinch 각에서 손끝 상승 ≤ 2.5 mm) | 0.184 mm | [, 2.5] | ✅ |
| R1 | Soft 모드: 열린 hard 손끝판이 Fin Ray 끝보다 ≥10 위 | 16.172 mm | [10.0, ] | ✅ |
| H5 | 바깥 피벗 드럼이 안쪽 피벗 축을 안 건드림 (r ≤ d - 4) | 16.0 mm | [, 20.0] | ✅ |
| H5b | 앞·뒤 드럼 안 겹침 (2·(yp + d - r) ≥ 3) | 43.0 mm | [3.0, ] | ✅ |
| H6 | 드럼 윗면이 손바닥 아랫면보다 아래 (bracket_drop ≥ r + 2) | 20.0 mm | [18.0, ] | ✅ |
| H7 | 완전 개방에서 두 링크 수직 거리 d·cos(ψ_open) ≥ 막대 높이 + 2 | 14.107 mm | [14.0, ] | ✅ |
| H9 | 안쪽 링크 갈래 사이 간격(12)이 드럼 두께(9)+여유 3 이상 — d·cosψ_open < r 라 일체형 링크는 드럼과 간섭 | 12.0 mm | [12.0, ] | ✅ |
| H10 | soft 드럼 안쪽 끝 x ≥ hard 브래킷 바깥 x + 1 | 17.0 mm | [17.0, ] | ✅ |
| S5 | 아랫장 측면 relief ≥ 손바닥 두께·tan|φ_min| (플랩이 −8° 까지 닫힐 공간) | 1.5 mm | [0.84, ] | ✅ |
| H11 | 열림 스토퍼 접촉점이 브래킷 안 (y ≤ 바깥 피벗 + 6) | 43.308 mm | [, 45.0] | ✅ |
| H12 | 링크 막대 바깥 면(4.5+막대두께) + 1 ≤ 브래킷 안쪽 면 (w/2+1) | 11.5 mm | [, 13.0] | ✅ |
| H8 | 바깥 피벗이 손바닥 안 (yp + d + 6 ≤ sy/2) | 43.5 mm | [, 44.0] | ✅ |
| H1 | pinch 8 N 에서 텐던 장력 ≤ 45 N (연속 루프 1가닥, 두 손가락 몫 각각) | 27.5 N | [, 45.0] | ✅ |
| C1 | 텔레스코프 이동 범위 ≥ 10 mm + 여유 2 | 13.0 mm | [12.0, ] | ✅ |
| C2 | 슬리브(굵은 빨대) 길이 ≥ 2 × 이동 (빠지지 않고 덜 기울게) | 30.0 mm | [26.0, ] | ✅ |

<details><summary>도출 치수</summary>

| 항목 | 값 |
|---|---|
| `soft_hinge_x` | 30.0 |
| `soft_reach` | 101.0 |
| `soft_phi_min_deg` | -7.9676 |
| `soft_x_min` | 16.0 |
| `soft_phi_battery_deg` | -2.8376 |
| `soft_phi_chip_deg` | -2.8376 |
| `soft_phi_sponge_deg` | 2.8376 |
| `soft_open_half_width` | 131.0 |
| `soft_pull_mm` | 22.2282 |
| `soft_string_T_at_limit_N` | 38.8462 |
| `hard_pivot_y` | 13.5 |
| `hard_coupler_below_E` | 26.3762 |
| `rigid_palm_height` | 101.3762 |
| `rigid_finray_tip_above_floor` | 6.5 |
| `hard_psi_cable_deg` | -4.6931 |
| `hard_tip_rise_cable_mm` | 0.1844 |
| `hard_psi_cap_deg` | 8.3636 |
| `hard_tip_rise_cap_mm` | 0.5849 |
| `hard_psi_min_deg` | -7.312 |
| `soft_mode_hard_above_finray` | 16.1718 |
| `hard_opening_mm` | 102.9919 |
| `soft_edge_interference_mm` | 0.8398 |
| `soft_stop_face_x` | 28.0405 |
| `hard_stop_tab_y` | 43.3084 |
| `hard_stop_tab_z` | -20.5119 |
| `hard_outer_bar_inner_gap` | 10.0 |
| `hard_string_T_N` | 27.5 |
| `hard_pull_mm` | 17.1215 |
| `hard_face_wedge_deg` | 0.0 |
| `float_sleeve_normal_N` | 22.528 |
| `float_friction_N_mu0.4` | 9.0112 |
| `float_locks_when_gripping` | 1.0 |
| `vertical_compliance_mm` | 13.0 |
| `float_k_N_per_mm` | 0.3 |

</details>

## B5N 긴 손톱 — 평행 링크 + 14 mm 접히는 손톱  —  PASS

| ID | 조건 | 값 | 범위 | 결과 |
|---|---|---|---|---|
| S1 | 건전지 끝 접촉각이 스토퍼보다 열린 쪽 (스토퍼가 건전지 지지를 막지 않음) | -2.838 deg | [-7.968, ] | ✅ |
| S2 | 스펀지 폭이 개방 범위 안 | 2.838 deg | [, 90.0] | ✅ |
| S3 | 칩 한계력에서 실 A 장력 (손으로 당길 만한가, ≤ 40 N) | 38.846 N | [, 40.0] | ✅ |
| R2 | Rigid(건전지): Fin Ray 끝이 바닥 위 [3,10] mm — 걸리지 않으면서 건전지 옆면에 닿음 | 6.5 mm | [3.0, 10.0] | ✅ |
| H2 | 케이블 Ø5 각이 손끝 맞닿음 각보다 열린 쪽 | -4.693 deg | [-7.312, ] | ✅ |
| H4 | 케이블 파지 시 손톱 끝이 케이블 반지름보다 아래 (pinch 각에서 손끝 상승 ≤ 2.5 mm) | 0.184 mm | [, 2.5] | ✅ |
| R1 | Soft 모드: 열린 hard 손끝판이 Fin Ray 끝보다 ≥10 위 | 16.172 mm | [10.0, ] | ✅ |
| H5 | 바깥 피벗 드럼이 안쪽 피벗 축을 안 건드림 (r ≤ d - 4) | 16.0 mm | [, 20.0] | ✅ |
| H5b | 앞·뒤 드럼 안 겹침 (2·(yp + d - r) ≥ 3) | 43.0 mm | [3.0, ] | ✅ |
| H6 | 드럼 윗면이 손바닥 아랫면보다 아래 (bracket_drop ≥ r + 2) | 20.0 mm | [18.0, ] | ✅ |
| H7 | 완전 개방에서 두 링크 수직 거리 d·cos(ψ_open) ≥ 막대 높이 + 2 | 14.107 mm | [14.0, ] | ✅ |
| H9 | 안쪽 링크 갈래 사이 간격(12)이 드럼 두께(9)+여유 3 이상 — d·cosψ_open < r 라 일체형 링크는 드럼과 간섭 | 12.0 mm | [12.0, ] | ✅ |
| H10 | soft 드럼 안쪽 끝 x ≥ hard 브래킷 바깥 x + 1 | 17.0 mm | [17.0, ] | ✅ |
| S5 | 아랫장 측면 relief ≥ 손바닥 두께·tan|φ_min| (플랩이 −8° 까지 닫힐 공간) | 1.5 mm | [0.84, ] | ✅ |
| H11 | 열림 스토퍼 접촉점이 브래킷 안 (y ≤ 바깥 피벗 + 6) | 43.308 mm | [, 45.0] | ✅ |
| H12 | 링크 막대 바깥 면(4.5+막대두께) + 1 ≤ 브래킷 안쪽 면 (w/2+1) | 11.5 mm | [, 13.0] | ✅ |
| H8 | 바깥 피벗이 손바닥 안 (yp + d + 6 ≤ sy/2) | 43.5 mm | [, 44.0] | ✅ |
| H1 | pinch 8 N 에서 텐던 장력 ≤ 45 N (연속 루프 1가닥, 두 손가락 몫 각각) | 27.5 N | [, 45.0] | ✅ |
| C1 | 손톱이 접히며 얻는 상승 ≥ 10 mm | 11.569 mm | [10.0, ] | ✅ |
| C2 | 손톱(강성 쪽: 안쪽 스토퍼)이 건전지 적도 높이(7)를 덮음 → 접히기 전엔 손톱 안쪽 면이 쥐는 면 | 14.0 mm | [7.0, ] | ✅ |

<details><summary>도출 치수</summary>

| 항목 | 값 |
|---|---|
| `soft_hinge_x` | 30.0 |
| `soft_reach` | 101.0 |
| `soft_phi_min_deg` | -7.9676 |
| `soft_x_min` | 16.0 |
| `soft_phi_battery_deg` | -2.8376 |
| `soft_phi_chip_deg` | -2.8376 |
| `soft_phi_sponge_deg` | 2.8376 |
| `soft_open_half_width` | 131.0 |
| `soft_pull_mm` | 22.2282 |
| `soft_string_T_at_limit_N` | 38.8462 |
| `hard_pivot_y` | 13.5 |
| `hard_coupler_below_E` | 26.3762 |
| `rigid_palm_height` | 101.3762 |
| `rigid_finray_tip_above_floor` | 6.5 |
| `hard_psi_cable_deg` | -4.6931 |
| `hard_tip_rise_cable_mm` | 0.1844 |
| `hard_psi_cap_deg` | 8.3636 |
| `hard_tip_rise_cap_mm` | 0.5849 |
| `hard_psi_min_deg` | -7.312 |
| `soft_mode_hard_above_finray` | 16.1718 |
| `hard_opening_mm` | 102.9919 |
| `soft_edge_interference_mm` | 0.8398 |
| `soft_stop_face_x` | 28.0405 |
| `hard_stop_tab_y` | 43.3084 |
| `hard_stop_tab_z` | -20.5119 |
| `hard_outer_bar_inner_gap` | 10.0 |
| `hard_string_T_N` | 27.5 |
| `hard_pull_mm` | 17.1215 |
| `hard_face_wedge_deg` | 0.0 |
| `vertical_compliance_mm` | 11.5689 |

</details>
