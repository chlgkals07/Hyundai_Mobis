# MOBIS Robotics Challenge — 골판지 그리퍼

직교 2축 역할 분담 그리퍼(hard 2 = y축, Fin Ray 4 = x축)의 골판지 버전을 시뮬 → 비교 → 전개도로 반복 설계하는 레포.
설계 결정 요약: `docs/DESIGN.md` · 비교: `docs/COMPARISON.md` · SymPy 리포트: `calc/REPORT.md`
뷰어(Artifact, 비공개): https://claude.ai/artifact/Qb8EG5pCeWV9fuD3PxMnuT

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
```
params 를 바꾸면 위 순서대로 전부 다시 돌린다 (calc → score/patterns → build).

## 구조
- `src/core/finray.ts` Fin Ray PBD: 플랭크 굽힘(EI) + 핀 리브, 접촉 SDF, 굽힘에너지 미분으로 힘 추정
- `src/core/modules.ts` soft 플랩/슬롯, 손톱 플랩, 쐐기 패드, whiffletree
- `src/core/designs.ts` B1/B2/B3/V5/V5b 조립 + 프리셋
- `src/core/collide.ts` OBB SAT 부품 간섭 + 바닥/물체 관통 + 실 걸림
- `src/core/pattern.ts` 전개도 부품 (params/calc 에서 생성)
- `src/viewer/` three.js r128(cdnjs UMD) + IIFE 번들. R3F 는 Artifact CDN 규칙 때문에 쓰지 않음

## 시뮬에서 발견해 반영한 것
- 건전지 pinch 는 '면 y = r' 가 아니라 '쥐는 면이 원통에 접하면서 손톱 끝이 바닥' (접선 조건)
- calc 의 손바닥 높이 기준 오류(z_top 이중 계산) 수정
- soft 실 장력은 접촉이 손끝 근처라 70% 가정이 낙관적 → 끝(R_s) 기준 + 손가락당 한계 2.5 N
- B3 텐던 손가락은 바닥에 손톱이 닿은 채 말면 원위지골이 수직을 못 넘어 jam → 공중에서 실 B 60% → 내림 → 조임
- V5b(B3+1-string)는 Fin Ray 가 끝까지 닫혀 텐던 손가락과 간섭 → 탈락

## 다음 할 일
- [ ] 목요일 실물: Fin Ray 1개 먼저 → EI(현재 600 N·mm² 추정) 보정, B2 슬롯 10분 테스트
- [ ] 실측값 반영: 골판지 두께, 빨대 외경, 고무줄 강성
- [ ] B1/B2 + B3 텐던 hard 하이브리드 iteration
- [ ] 팀원 R4 팔과 결합 (wrist roll, 텐던 커플링)
