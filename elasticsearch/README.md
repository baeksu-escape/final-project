# Avenue 검색 서버 (Elasticsearch)

2차 개발(FP-304)에서 **신용 라운지 글 검색**에 쓰는 검색 서버다. 한글 분석기 nori로 "대출이 어렵나요"에서 "대출"·"어렵"처럼 낱말을 나눠 찾는다.

```
브라우저(React) → Spring Boot(8080) → Oracle DB
                         └→ Elasticsearch(9200)  ← 설정으로 켰을 때만
```

- **버전 8.10.4** — Spring Boot 3.2.5가 관리하는 클라이언트 버전과 같다(`docs/ai/decisions.md` D-07).
- **띄우지 않아도 된다.** 백엔드 설정 `avenue.search.enabled`는 기본 `false`이고, 꺼져 있으면 라운지 검색은 지금처럼 Oracle로 동작한다. 검색 기능을 맡거나 시연하는 PC만 띄운다.
- 개발·시연용이라 **보안(비밀번호·HTTPS)을 끄고** 이 PC(`127.0.0.1`)에만 연다. 실제 서비스처럼 외부에 열지 않는다.
- 메모리를 1GB 쓴다. 부족하면 아래 방법 ①의 `-Heap 512m`.

## 1. 띄우기

### 방법 ① Windows zip (Docker 없이)
1. [Elastic 다운로드](https://www.elastic.co/downloads/past-releases/elasticsearch-8-10-4)에서 `elasticsearch-8.10.4-windows-x86_64.zip`을 받아 **저장소 밖**에 푼다. 예: `C:\workspace\tools\elasticsearch-8.10.4`
   - 자바가 들어 있어 따로 설치할 것이 없다.
2. 한글 분석기 설치 (처음 한 번)
   ```powershell
   & C:\workspace\tools\elasticsearch-8.10.4\bin\elasticsearch-plugin.bat install analysis-nori
   ```
3. 실행 (이 폴더에서, 창을 켜 둔다. 끄려면 `Ctrl+C`)
   ```powershell
   .\run-windows.ps1 -EsHome C:\workspace\tools\elasticsearch-8.10.4
   ```
   - 스크립트 실행이 막혀 있으면 그 창에서만 `Set-ExecutionPolicy -Scope Process Bypass` 후 다시 실행한다.

### 방법 ② Docker
- Docker Desktop(Windows는 AMD64, WSL 2)을 설치하고 켠다. "Virtual Machine Platform" 오류가 나면 관리자 PowerShell에서 `wsl --install` → 재부팅 → 다시 설치.
- **설치 전에 열려 있던 터미널·VS Code는 다시 연다.** 그대로 쓰면 `docker-credential-desktop ... not found in %PATH%` 오류가 난다.

```
cd elasticsearch
docker compose up -d        # 처음에는 이미지를 만들며 nori를 설치한다
docker compose down         # 끄기 (색인은 avenue-es-data 볼륨에 남는다)
```

## 2. 확인
```
curl http://localhost:9200                 # "number" : "8.10.4"
curl http://localhost:9200/_cat/plugins    # analysis-nori
```
PowerShell에서는 `curl.exe`로 쓴다.

## 3. 백엔드와 연결
1. `backend/src/main/resources/application.properties`(각자 파일)에 한 줄을 바꾼다.
   ```
   avenue.search.enabled=true
   ```
   주소가 다르면 `avenue.search.url`도 고친다(기본 `http://localhost:9200`).
2. 백엔드를 켜면 로그에 다음이 나온다.
   - `Elasticsearch 8.10.4 연결 (http://localhost:9200)`
   - `Elasticsearch 색인 lounge_posts 만듦` (다음부터는 `있음`)
3. 한글 분석 확인
   ```
   curl -X POST http://localhost:9200/lounge_posts/_analyze -H "Content-Type: application/json" -d "{\"analyzer\":\"lounge_korean\",\"text\":\"대출이 어렵나요\"}"
   ```

Elasticsearch가 꺼져 있거나 주소가 틀리면 백엔드는 그대로 켜지고 `Elasticsearch를 준비하지 못했습니다` 경고만 남는다.

## 4. 색인 정의
| 색인 | 정의 파일 | 쓰는 곳 |
|---|---|---|
| `lounge_posts` | `backend/src/main/resources/search/lounge-posts.json` | 신용 라운지 글 검색 (FP-304) |

- 색인이 **없을 때만** 백엔드가 켜질 때 만든다. 정의 파일을 바꿨으면 색인을 지우고(`curl -X DELETE http://localhost:9200/lounge_posts`) 백엔드를 다시 켠다.
- 다른 기능이 검색을 쓰려면 정의 파일 하나와 `SearchIndexDefinition` 빈 하나를 더한다(예: `backend/.../community/service/LoungeSearchIndex.java`). 연결 코드는 `backend/.../global/search/`에 있다.
- 글을 색인에 넣고 지우는 일과 라운지 검색을 바꾸는 일은 FP-306에서 한다.
