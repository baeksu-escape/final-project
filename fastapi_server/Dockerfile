# FP-142 예측 서버(FastAPI) 컨테이너 — 어느 PC에서든 같은 Python·라이브러리로 ML-01~04를 켠다.
# 만들기: (저장소 맨 위에서) docker build -t avenue-fastapi fastapi_server
# 켜기:   docker run -d -p 8000:8000 --name fastapi avenue-fastapi   → http://localhost:8000/docs
FROM python:3.11-slim

# LightGBM이 실행할 때 쓰는 시스템 라이브러리 (slim 이미지에는 없다)
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 라이브러리 먼저 설치 — requirements.txt가 그대로면 다시 만들 때 이 단계를 건너뛰어 빠르다
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 서버 코드만 넣는다(학습 데이터·생성 코드·테스트는 .dockerignore로 뺀다)
COPY main.py .
COPY routers/ routers/
COPY schemas/ schemas/
COPY pipeline/ pipeline/
COPY artifacts/ artifacts/

EXPOSE 8000
# 0.0.0.0 = 컨테이너 밖(-p로 연결한 내 PC 포트)에서 들어오는 요청을 받는다
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
