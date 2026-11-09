# fastapi_server/data — 학습용 합성 데이터 (Git 제외)

이 폴더의 내용은 Git에 올리지 않는다(`.gitignore`). 팀 공유 드라이브에서 압축 파일을 받아 아래처럼 푼다. **데이터 버전은 이 표에서만 관리한다.**

| 폴더 | 현재 버전 | 원본 압축 | 압축 파일 | 비고 |
|---|---|---|---:|---|
| `training/` | v3.5.12 | `avenue_training_data_v3_5_12.zip` | 약 19.0MB | 데이터 값은 v3.5.10과 같다(문서와 `3_reference/legacy/validation.json`의 실행 환경 기록만 바뀜). 생성 코드 묶음은 `credit_extension_light_v3_5_12.zip`(약 2.1MB). 데이터 사용법은 풀고 나서 `training/README.md` |

## 압축 푸는 법

1. `fastapi_server/data/` 안에 `training/` 폴더를 만든다(이미 있으면 안의 내용을 모두 지운다).
2. 압축을 **`training/` 안에** 푼다. 압축 파일에는 맨 위 폴더가 없고 `1_model/`, `2_detail/` 등이 바로 들어 있다. `fastapi_server/data/`에 바로 풀거나 `training/avenue_training_data_v3_5_12/`처럼 한 단계 더 생기면 잘못 푼 것이다.
3. `fastapi_server/data/training/1_model/legacy_model_table.csv`가 있으면 맞게 푼 것이다.

풀고 난 모습:

```
fastapi_server/data/
├─ README.md                ← 이 파일 (Git)
└─ training/                ← 여기에 압축을 푼다 (Git 제외)
   ├─ README.md             ← 데이터 사용법 (압축에 포함)
   ├─ 1_model/              모델 학습 표 2개 + 열 역할표(model_table_columns.csv)
   ├─ 2_detail/
   │  ├─ legacy/            기존 집단 상세 원천
   │  └─ thinfile/          씬파일 집단 상세 원천
   ├─ 3_reference/
   │  ├─ legacy/            설계값·점검 결과·anomaly_log.csv
   │  ├─ thinfile/          설계값·점검 결과·anomaly_log.csv
   │  └─ nonfinancial_label_lift/
   ├─ docs/                 데이터 사전·생성 규칙
   └─ .handoff_bundle       파일 목록 (지우지 않는다)
```

- 생성 코드: `fastapi_server/data_generation/` (같은 v3.5.12 패키지)
- 서비스 DB 더미(학습에 쓰지 않음): `docs/spec/sql/dummy_db/`
- 폴더 이름에는 버전을 넣지 않는다. 새 버전을 받으면 `training/`을 통째로 교체하고 위 표의 버전만 고친다
- 공유 드라이브 경로: 팀 디스코드 #파일공유 채널 참고