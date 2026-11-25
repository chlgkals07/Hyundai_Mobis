# MOBIS Robotics Challenge — 골판지 그리퍼

직교 2축 역할 분담 그리퍼: **soft Fin Ray 4개(x 축)** + **hard 평행 링크 손가락 2개(y 축)**.
골판지·빨대·실·고무줄·풀로 만드는 영상 과제용 버전을 **치수 파라미터 → SymPy 검증 → 3D 시뮬 → 비교 채점 → 1:1 전개도 → 조립 애니메이션** 으로 반복 설계한다.

현재 기준안: **B5N** (평행 링크 hard + 14 mm 접히는 손톱). 팔 결합은 [`docs/ARM-HANDOFF.md`](docs/ARM-HANDOFF.md).

팔을 제작할 때는 [R5-F1 A3 재단도·3D 조립 영상·배선표](arm/R5-F1/README.md)를 사용한다. 이전 설계는 [R4 × B5N 시연·제작 자료](arm/R4-B5N/README.md)에서 볼 수 있다.

## 바로 보기 (빌드 결과, 브라우저로 열기)
| 파일 | 내용 |
|---|---|
| [`docs/site/index.html`](docs/site/index.html) | 목록 |
| `docs/site/bench.html` | 설계안 시뮬레이터 · 비교표 · 전개도 (현재 후보 / 보관) |
| `docs/site/assembly.html` | B5N 조립 과정: 전체 애니메이션 · 블록별 조립 · 메커니즘 단면도 · 전개도 |
| `docs/site/arm.html` | 팔(R4, 가정 치수) + 그리퍼 결합 · 간섭 확인 |
| `docs/B5N-조립과정.mp4` | 94 초 조립 영상 |
| `patterns/B5N/B5N-전개도-A4.pdf` | **인쇄용 1:1 전개도** (A4, 실제 크기 100%) |

three.js 는 CDN(cdnjs, jsdelivr)에서 불러오므로 인터넷이 필요하다.

## 설치·실행
```bash
npm ci                     # Node 22
pip install sympy          # Python 3.10+
python3 calc/run_all.py    # SymPy 조건 검증 → calc/out/*.json, calc/REPORT.md
python3 calc/envelope.py   # 그리퍼 점유 공간·장착 영역·실 마찰 → calc/out/envelope.json
npx tsx scripts/test.ts B5N        # 헤드리스 시뮬 (프리셋 6자세 계측 + 간섭)
npx tsx scripts/approach.ts        # 팔 높이 오차 테스트
npx tsx scripts/arm-check.ts       # 팔↔그리퍼 간섭표 → docs/arm-check.md
npx tsx scripts/score.ts           # 채점 → docs/COMPARISON.md
npx tsx scripts/patterns.ts        # 전개도 → patterns/<ID>/ (SVG, A4 PDF, 부품표)
npx tsx scripts/diagrams.ts        # 메커니즘 단면도 → docs/diagrams/*.svg
npm run build                      # HTML → out/ + docs/site/
node scripts/record-assembly.mjs   # 조립 영상 → docs/B5N-조립과정.mp4 (Playwright + ffmpeg)
```
**params 를 바꾸면** `calc → score/patterns/diagrams → build` 순서로 다시 돌린다. 스크린샷·PDF·영상은 Playwright Chromium 이 필요하다.

## 폴더 구조
```
params/            치수 단일 소스 (JSON). Python calc 와 TS 코어가 같이 읽음
  common.json        재료(골판지 3 mm, 빨대 Ø6/Ø12), Fin Ray, 물체 5종, 힘 한계
  B5N.json …         설계안별 (B1–B5, B5F/B5N/B5T, V5 계열은 코드에서 파생)
  arm/R4.json        팔 치수 (⚠ 가정값 — 실측으로 교체)
calc/              SymPy 검증
  designs.py         설계안별 조건 (S·R·H·C·J 번호) → calc/out/<ID>.json, REPORT.md
  envelope.py        팔 결합용 수치
  optimize_b3.py     B3 치수 최적화 (보관안)
  capacity.py        개구 범위
src/core/          시뮬 엔진 (TypeScript, three.js 수학만 사용)
  types.ts           Part(상자/원통) · Line(실) · Assembly · Design
  finray.ts          Fin Ray PBD (플랭크 굽힘 + 핀 리브, 힘 추정)
  modules.ts         soft 플랩·슬롯, 손톱, whiffletree 등 공용 모듈
  designs.ts         설계안 조립·프리셋. CURRENT(현재 후보) / OLD(보관) + OLD_REASON
  collide.ts         OBB 충돌, 바닥·물체 관통, 실 걸림
  pattern.ts         전개도 부품 (cut/score/glue/hole/flute)
  diagrams.ts        메커니즘 단면도 SVG
  arm.ts             팔 FK/IK, 그리퍼 장착, 결합 충돌
src/viewer/        HTML 페이지 (vanilla three.js r128 + IIFE 번들)
  main.ts/page.html          설계안 벤치
  assembly.ts/assembly.html  조립 과정 (STEPS 전체 / BLOCKS 블록별)
  arm.ts/arm.html            팔 결합
scripts/           test · approach · score · patterns · diagrams · arm-check · build-viewer · record-assembly · shots
data/viewer-data.json   비교표·전개도 데이터 (score.ts / patterns.ts 가 갱신, 뷰어가 import)
patterns/<ID>/     현재 후보 전개도 (SVG, PDF, README 부품표) · patterns/old/ 보관안
docs/              ARM-HANDOFF.md · DESIGN.md · COMPARISON.md · arm-check.md · diagrams/ · shots/ · site/ · 영상
CLAUDE.md          설계 결정·발견·수정 이력 (작업 규칙 포함)
```

## 새 설계안/부품을 추가하는 법 (요약)
1. `params/<ID>.json` 작성 → `calc/designs.py` 에 조건 함수 추가 (`run_all` 의 목록에)
2. `src/core/designs.ts` 에 `makeXxx()` (Part 를 만들어 `assemble`) → `CURRENT` 에 추가
3. `scripts/test.ts <ID>` 로 간섭 0 확인 → `score.ts` 의 RISK/HAND 에 근거 한 줄
4. `src/core/pattern.ts` 에 전개도 함수 → `PATTERNS`
5. `npm run build`

## 규칙
- 수치(기하·힘·각도·간섭)는 SymPy 로 검증한 값만 문서에 쓴다 (`calc/out` 에 남음).
- 시뮬은 관절을 이상적(마찰·유격 없음)으로 본다 → 실물로 확인할 항목은 `CLAUDE.md` "다음 할 일".
