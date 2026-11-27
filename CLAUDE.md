# MOBIS Robotics Challenge — 골판지 그리퍼

직교 2축 역할 분담 그리퍼(hard 2 = y축, Fin Ray 4 = x축)의 골판지 버전을 시뮬 → 비교 → 전개도로 반복 설계하는 레포.
설계 결정 요약: `docs/DESIGN.md` · 비교: `docs/COMPARISON.md` · SymPy 리포트: `calc/REPORT.md`
뷰어(Artifact, 비공개): https://claude.ai/artifact/Qb8EG5pCeWV9fuD3PxMnuT

> **⚠ 이 레포의 최종본은 '영상 과제용' 설계다 (하민, 2026-11-23).** 손 구동·골판지, 영상 물체(건전지·케이블·스펀지·뚜껑·칩)만 들면 된다.
> 본선 그리퍼 힘은 고려하지 않는다. 힘은 키우지 말 것: hard pinch 1–2 N(하한 0.85 N), soft ≤ 0.5 N/손가락. 근거는 `docs/FINAL-CHANGES.md` §1.

## 작업 규칙 (하민 선호)
- 수치 계산(기하·힘·각도·간섭)은 `calc/`에서 SymPy로 검증 후 제시
- 치수 단일 소스: `params/*.json` (Python calc + TS core 공용). calc 결과 `calc/out/*.json` 을 TS 가 import
- 새 구현은 선택지 비교 후 추천, 긴 작업은 개요 → 한 단계씩
- 한국어, 기술 용어 영어 원문 허용

## 파이프라인
```bash
python3 calc/run_all.py          # SymPy 조건 → calc/out/*.json, calc/REPORT.md
npx tsx scripts/test.ts [ID]     # 헤드리스 시뮬: 프리셋 6자세 계측 + 간섭
npx tsx scripts/score.ts         # 채점 → docs/COMPARISON.md + out/viewer-data.json
npx tsx scripts/patterns.ts      # 전개도 → patterns/<ID>/*.svg, *-전개도-A4.pdf, README.md
npm run build                    # 뷰어 → out/gripper-bench.html (Artifact), out/local.html
node scripts/shots.mjs           # Playwright 스크린샷 → docs/shots/
node scripts/record-assembly.mjs 20 - B5E # 조립 애니메이션 → docs/<B5E|B5N>-조립과정.mp4 (프레임 캡처 + ffmpeg)
node scripts/manual-shots.mjs    # 설명서 그림 → docs/manual-img/*.png (build 후, 조립 페이지 캡처)
npx tsx scripts/diagrams.ts      # 메커니즘 단면도 → docs/diagrams/*.svg (B5N), docs/diagrams/B5E/*.svg
python3 calc/envelope.py         # 팔 결합용 그리퍼 점유 공간·장착 영역·실 마찰
npx tsx scripts/arm-check.ts     # 팔↔그리퍼 간섭표 → docs/arm-check.md (params/arm/R4.json 은 가정값)
```
params 를 바꾸면 위 순서대로 전부 다시 돌린다 (calc → score/patterns → build).

## 구조
- `src/core/finray.ts` Fin Ray PBD: 플랭크 굽힘(EI) + 핀 리브, 접촉 SDF, 굽힘에너지 미분으로 힘 추정
- `src/core/modules.ts` soft 플랩/슬롯, 손톱 플랩, 쐐기 패드, whiffletree
- `src/core/designs.ts` 조립 + 프리셋. `CURRENT`(B6P, B6F, B5N — 2026-11-27 실물 시도 후 쉬운 버전 2종 + 기준 B5N, B5E 는 old) / `OLD`(+`OLD_REASON`) 로 나눔 — 뷰어·비교·전개도가 이 구분을 따름
- `scripts/approach.ts` 접근 높이 오차(손바닥을 e mm 더 내림) 테스트 → '수직 순응' 채점
- `calc/optimize_b3.py` B3 치수 최적화 (랜덤 탐색 + SymPy 재검증) → `params/B3o.json`
- `calc/capacity.py` 개구 범위 (B1/B2/B3)
- B5 = 평행사변형 링크 hard + 텐던 1가닥 루프 (B3o 의 '젖힌 원위'가 어색하다는 피드백 후)
- `src/core/collide.ts` OBB SAT 부품 간섭 + 바닥/물체 관통 + 실 걸림
- `src/core/pattern.ts` 전개도 부품 (params/calc 에서 생성)
- `src/viewer/` three.js r128(cdnjs UMD) + IIFE 번들. R3F 는 Artifact CDN 규칙 때문에 쓰지 않음
- `src/viewer/assembly.ts` 조립 과정 애니메이션 (전개도 자르기 → 부품 → 12단계 조립 → 동작 → 실현성). B5E/B5N 버튼 전환(`?d=`), `setDesign()` 이 설계 의존 상태를 다시 만듦. Artifact: https://claude.ai/artifact/VBuZDZwSdEKW868aH6jNfw

## 시뮬에서 발견해 반영한 것
- 건전지 pinch 는 '면 y = r' 가 아니라 '쥐는 면이 원통에 접하면서 손톱 끝이 바닥' (접선 조건)
- calc 의 손바닥 높이 기준 오류(z_top 이중 계산) 수정
- soft 실 장력은 접촉이 손끝 근처라 70% 가정이 낙관적 → 끝(R_s) 기준 + 손가락당 한계 2.5 N
- B3 텐던 손가락은 바닥에 손톱이 닿은 채 말면 원위지골이 수직을 못 넘어 jam → 공중에서 실 B 60% → 내림 → 조임
- ~~V5b 간섭 탈락~~ → Fin Ray PBD 가 고정 8단계로 큰 각도를 점프하던 터널링 버그였음. 2°/단계로 고친 뒤 간섭 없음
- B4 는 B2 Fin Ray(도달 105)가 텐던 Rigid 높이(101.4)보다 길어 바닥 충돌 → 캐리지 뿌리 10→2 mm (도달 97)

## 선택: B3o (2026-11-23)
하민 결정: 개구 범위 때문에 직선(B2) 대신 회전·텐던(B3 계열). B3o = B3 최적화.
- 원위 휴지 58° 젖힘(스토퍼) + 근위 휴지 17°, l1 75 / l2 35 (손톱 9), r1 13 / r2 10, Fin Ray 뿌리 8
- 예비 말기 불필요: 손톱이 바깥(y≈63)에서 바닥에 닿아 미끄러져 들어옴 (SymPy J1, J2, J5 구동력 ≥1.9 N)
- 복원 고무줄 k1 = 40 N·mm/rad (상한 203), k2/k1 = 2.2. 너무 센 고무줄이면 바닥에서 멈춤
- 텐던 장력 하한 28 N (B3 50 N), 개구 175×187 mm
- 시뮬 파지 방식은 '떠서 감싸기'(손톱이 물체 밑, 원위 패드가 위) — 적도 평행 pinch 아님. 실물로 확인
- 최적화 중 정식화 4번 수정: (1) 경로 중 바닥 아래 금지 → 불가능, (2) pinch=경로 최저점 → 최저점이 피벗 아래,
  (3) 평행 pinch 는 θ2_rest>0 필요, (4) 방향(J2)만으론 부족 → 구동력 크기(J5), 손톱 길이(J4)
- 시뮬 솔버: 경사 하강 → 16방향 패턴 탐색 (좁은 접촉 골짜기에서 멈추던 문제)

## B5 평행 링크 (2026-11-23)
- 피벗 2개를 손바닥 아래 브래킷에 **수평**(간격 d=24)으로: 처음엔 위·아래로 쌓았다가 링크가 수직일 때 겹쳐 실패
- 피벗 y=±13.5 → 건전지 pinch 에서 링크 수직 = 손끝 최저점 → 바닥 파고듦 없음
- 드럼(r=16)은 바깥 피벗, 안쪽 링크는 두 갈래로 드럼을 비켜 감 (열릴 때 d·cosψ=9 < r)
- 텐던 1가닥 연속 루프(앞 드럼→모터 풀리→뒤 드럼)로 자동 균형, 장력 27.5 N, 개구 116 mm

## 수직 순응 옵션 (2026-11-23, 하민: 닫힘 방향 순응은 Fin Ray 담당 → hard 는 수직만)
목표 ±10 mm (팔 높이 오차 가정). 현재 후보:
- **B5N 긴 손톱** 14 mm 접힘 → 12 mm 까지 유지, 추가 부품 없음 (1순위)
- **B5F 플로팅** 손바닥 위 빨대 텔레스코프 2쌍(슬리브 30, 이동 13) → 14 mm, 손끝 안 기움. 쥐면 마찰로 잠김(장점)
- B5 기본 4 mm
탈락: B5T 손끝판 관절(바닥 힘이 손끝을 물체 쪽으로 돌림 → 쥐면 무력화, SymPy C3), 손바닥 힌지(10 mm 에 손끝 22 mm 안쪽, calc 만)
같이 고친 것: hard 폭 28→24·soft 드럼 r 15→13 (브래킷↔soft 드럼 간섭이 palm 인접 처리로 가려져 있었음, H10),
Fin Ray 솔버 터널링(고정 8단계 → 2°/단계; V5b '간섭 탈락' 은 이 버그였음)
참고: 같은 채점에서 보관된 B3 가 63.3 으로 가장 높음 (텐던 underactuation 이 수직 순응 14 mm) — 단 예비 말기·50 N

## 조립 메커니즘 검토 (2026-11-23, 풀 사용 허용)
- 플랩이 −8° 로 닫히면 손바닥 옆면 0.84 mm 간섭 (시뮬은 palm–flap 인접이라 못 잡음) → 아랫장 좌우 1.5 mm 좁게 (S5)
- 링크 막대는 y–z 판(높이 12): 앞·뒤 링크 같은 평면 → d·cosψ ≥ 14 → 열림 68°→54°, 개구 103 mm (H7 수정)
- 드럼을 빨대 축에 풀칠하면 토크가 플라스틱에 걸려 헛돎 → 드럼을 바깥 링크 막대 2개 사이에 면 접착 (H12), 빨대는 핀만
- 추가 부품: soft 닫힘 스토퍼 블록, hard 열림 스토퍼 탭(H11 접촉점), 브래킷 삼각 보강, 구멍 맞춤 시험편, 손톱 3겹
- 단면도 `src/core/diagrams.ts` (→ docs/diagrams/*.svg), 블록별 조립 애니메이션은 조립 Artifact '블록별 조립' 탭

## B5E 쉬운 버전 (2026-11-25, 하민: E1 선택)
B5N 형상 그대로, 드럼 6개(3장 적층·중심 맞춤·실 감기) → V자 레버 판 4개 + 레버 끝 매듭. 영상용 설계 (`params/B5E.json` force_video).
- soft 레버 r26·폭 8·2겹, 열림 자세에서 손바닥 윗면 위 23°. 실 A 는 레버 끝 → x=±29 위로. 모멘트 팔 19.6–26 (B5N 드럼 13) (SymPy E1–E4)
- soft 열림 30°. 레버가 손바닥 슬롯 끝에 닿는 φ≈35° 가 자연 열림 스토퍼 → 별도 스토퍼 블록 불필요 (E11, R4 끝판 간섭 45° 미만)
- hard 레버 r16·3겹, 바깥 링크 막대 사이(드럼 자리)에 발 26 mm 면 접착, 열림에서 안쪽 수평 아래 16°. 텐던 구멍 y=±28.5. 모멘트 팔 13.8–16 (E5–E8)
- ⚠ hard 레버 끝 ↔ 안쪽 축 빨대 여유가 계산상 딱 1 mm (E5 경계) → 실물에서 끝까지 돌려 확인
- 영상용 장력: 텐던 6.0 N (pinch 1.5 N), 실 A 5.2 N (Fin Ray 0.5 N) (E4, E9, E10)
- 판 수는 비슷(드럼 12장 → 레버 10장). 쉬워진 건 '원판 중심 맞춤·홈·감기'가 없어진 것
- 젓가락 축은 허용 (하민 확인, 2026-11-25)
- 조립 애니메이션·단면도·블록별 조립(블록 A = V자 레버 만들기) B5E 버전 추가, 영상 `docs/B5E-조립과정.mp4`
- B5F·B5 는 보관(old)으로 이동
- 빌드 버그: 번들에 `$&` 가 생기자 `String.replace` 치환 패턴으로 해석돼 HTML 이 깨짐 → `build-viewer.mjs` 를 함수형 replace 로 (48a6659 의 docs/site 는 깨져 있었음)

## B6 쉬운 버전 2종 (2026-11-27, 하민: B5E 실물 시도 → 부품·구멍 과다, 골판지 정확도 부족)
DIY 골판지 손 원칙(관절 = 접는 선·테이프, 실은 빨대 터널, 한 줄로 여러 손가락) + 컨셉(앞뒤 hard / 좌우 Fin Ray) 유지.
- 공통 soft: 레버·슬롯·균형막대·Fin Ray 밑판 없음. 플랩 안쪽 매듭(힌지에서 14) → 손바닥 구멍 x=±5 → 좌우 한 가닥 루프. 팔 10.6–13.7, 장력 9.5 N (S6–S9). Fin Ray 띠 앞에 플랩 풀칠 탭 12. 닫힘 블록은 실 경로 피해 y=−24…−4
- **B6P**: 평행 링크를 띠 한 장(윗변 24·링크 75·아랫변 24·링크 75·탭 12) 접은 납작한 상자로. 윗변을 손바닥 아래 풀칠(피벗 z=−3, L 55→75). 핀·구멍 0, 평행은 두 링크 길이만. 실은 안쪽 링크 매듭(윗 접는 선에서 70) → 손바닥 가운데 구멍, 앞뒤 한 가닥. 쥘 때 팔 10.8–11.7, 장력 9.9 N (F1–F4). 개구 135. 판 26조각
- **B6F**: B3 2마디 텐던 손가락을 테이프 힌지 + 빨대 터널(판 6 + 빨대 3 = r 9)로. k2/k1 = 2.18 (J2 고무줄을 더 세게), 장력 8.3 N. 판 18조각. 공중에서 60% 먼저 말기
- ⚠ 두 안 모두 장력이 손 한계 10 N 근처 → 실 마찰 줄이기 중요. 관절 테이프 수명은 실물 확인
- 전개도 전량판: `patterns/B6P/B6P-전개도-전량-A4.pdf` (4장), `patterns/B6F/…` (3장). 설명서·조립 애니메이션은 아직 B5E/B5N

## 다음 할 일
- [ ] 목요일 실물 (B5E 권장, B5N 도 가능): Fin Ray 1개 → EI 보정, 평행 링크 손가락 1개 → 손끝판 수직 유지·손톱 접힘 확인
- [ ] 팔 높이 오차 실측 → 수직 순응 목표(현재 ±10 가정) 갱신
- [ ] 실측값 반영: 골판지 두께, 빨대 외경, 고무줄 강성
- [x] 하이브리드 B4 (B2 soft + B3 텐던 hard): 물체 5/5, 간섭 0, 42.4점
- [x] 팀원 R4 팔 PR #1 머지 (`arm/R4-B5N/`)
- [ ] 최종본 수정 사항: `docs/FINAL-CHANGES.md` (영상용 힘 목표·soft 드럼·30° 스토퍼는 B5E 로 반영, 남은 것: 꺾임, 내림 하한, 레포 통합)
- [x] B5E 조립 애니메이션·단면도
- [ ] 팀원 R5-F1 팔 PR #2: 소스·높이 표 요청 리뷰 남김, 머지 대기
