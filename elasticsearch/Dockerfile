# FP-305 개발·시연용 Elasticsearch 8.10.4 + 한글 분석기 nori. docker-compose.yml이 이 파일로 이미지를 만든다.
# 버전은 Spring Boot 3.2.5가 관리하는 클라이언트 버전과 같게 맞췄다(docs/ai/decisions.md D-07).
FROM docker.elastic.co/elasticsearch/elasticsearch:8.10.4
RUN bin/elasticsearch-plugin install --batch analysis-nori
