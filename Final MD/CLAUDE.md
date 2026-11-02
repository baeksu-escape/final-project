@AGENTS.md

## Claude Code 전용

- 파일 여러 개를 고치거나 공유 파일(`AGENTS.md` 3-1)을 건드리는 작업은 plan 모드로 계획을 먼저 보여 주고 승인을 받는다.
- 기존 파일은 Edit으로 바꿀 부분만 고친다. Write로 통째로 덮어쓰지 않는다(새 파일만 Write).
- `.claude/settings.json`에 걸어 둔 확인 요청(CSS 수정, `git push` 등)을 임의로 풀거나 고치지 않는다. 확인 창이 뜨면 이유를 함께 설명한다.
