# MOBIS Robotics Challenge — 골판지 그리퍼

설계 배경·컨셉 전체: `docs/HANDOFF.md` (작성 예정, claude.ai 핸드오프 문서 원본)

## 작업 규칙
- 수치 계산(기하·힘·각도·간섭)은 `calc/`에서 SymPy로 검증 후 제시
- 치수 단일 소스: `params/*.json` (Python calc + TS core 공용)
- 한국어, 기술 용어 영어 원문 허용

## 밤샘 자율 작업 계획 (2026-11-23)
아키텍처가 다른 baseline 3개 → 객관 점수 → 상위안에 V5(1-string 순차) variation.
- B1 회전: 측면 플랩(score 힌지)+Fin Ray 2개씩 / hard 단일 피벗+손톱 플랩
- B2 직선: Fin Ray 캐리지가 빨대 레일 위 x 평행이동 / hard 캐리지 y 평행이동
- B3 말림: soft는 B1 동일 / hard는 2마디 텐던 손가락(score 관절, 고무줄 복원)+손톱
공통 제약: Fin Ray 스토퍼 x_min ≥ w_h/2 + margin, Soft 모드에서 hard 손끝이 Fin Ray보다 위, 플랩 완전 개방.
Fin Ray 모델: 플랭크 = 강체 마디 + 회전 스프링, 리브 = 강체 + 핀 (순수 핀 링크는 mechanism이라 불가).
스택: Vite + React + R3F 뷰어(단일 HTML → Artifact), pdf-lib로 1:1 mm SVG/A4 PDF 전개도, Playwright 스크린샷.
가정 치수: 골판지 3 mm(B골), 빨대 외경 6 mm / 버블티 12 mm (실측 시 교체).

## 진행 상황
- [x] 레포 연결, 의존성 설치
- [ ] 엔진 → B1 → B2 → B3 → 점수 → V5 → 전개도 → Artifact
