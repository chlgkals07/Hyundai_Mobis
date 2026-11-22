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
