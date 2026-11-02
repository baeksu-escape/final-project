# fastapi_server/data — 학습용 합성 데이터 (Git 제외)

이 폴더의 내용은 Git에 올리지 않는다(`.gitignore`). 팀 공유 드라이브에서 받아 아래 위치에 압축을 푼다.

| 폴더 | 현재 버전 | 원본 압축 | 크기 | 비고 |
|---|---|---|---:|---|
| `training/` | v3.5.7 | `avenue_training_data_v3_5_7.zip` | 약 95MB | 시작은 `training/README.md`. 모델에는 `1_model/model_table_columns.csv`에서 역할이 `feature`인 열만 넣는다 |

- 생성 코드: `fastapi_server/data_generation/` (같은 v3.5.7 패키지)
- 서비스 DB 더미(학습에 쓰지 않음): `docs/spec/sql/dummy_db/`
- 폴더 이름에는 버전을 넣지 않는다. 새 버전을 받으면 `training/`을 통째로 교체하고 위 표의 버전만 고친다
- 공유 드라이브 경로: (형상 관리자가 기입)
