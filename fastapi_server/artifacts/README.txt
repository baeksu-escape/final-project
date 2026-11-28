Avenue 기존·대안 모델 파일 (임시 베이스라인, 합성 데이터로 학습, 실제 신용평가 결과 아님)

받는 법
1) 이 4개 파일을 저장소의 fastapi_server/artifacts/ 에 넣는다. (Git에는 올라가지 않는다: .gitignore)
2) 파일이 맞는지 확인: SHA256SUMS.txt 의 해시와 같아야 한다.
   PowerShell:  Get-FileHash legacy.joblib -Algorithm SHA256   (나머지도 같은 방식)
3) LightGBM 4.6.0 으로 불러온다(requirements.txt 와 같은 버전).

파일
- legacy.joblib       기존 모델 (피처 18개, 정답 label_any_delinquency_12m)
- alternative.joblib  대안 모델 (피처 38개, 정답 label_nonfin_effect_12m)
- *.meta.json         모델 버전(LGBM-BASE-0.1)·피처 세트(FS-V1)·알고리즘, 피처 순서(features), 범주 부호표(category_codes), 이상치 상한(c8_limits), 설정, 학습 표 SHA-256 앞 8자리 79511b5d

입력·출력 규격: fastapi_server/training/README.md 「모델 입력·출력 규격」, 변환 함수 training/interface.py 의 to_model_input
출력: predict_proba(X)[:, 1] = 불량(양성) 확률. 점수(0~1000) 변환은 명세서 O-3, 서비스 쪽.
joblib 은 불러올 때 파일 안의 코드가 실행될 수 있으니 이 묶음 외의 출처에서 받은 .joblib 은 열지 않는다.
