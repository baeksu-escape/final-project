# FP-305 Elasticsearch 8.10.4를 개발·시연용으로 띄운다(Windows zip, Docker 없이). 사용법은 같은 폴더 README.md.
# 보안(비밀번호·HTTPS)을 끄고 한 대짜리(single-node)로 띄운다. 이 PC에서만 쓰는 개발용이다(외부에 열지 않는다).
# 사용 예: .\run-windows.ps1 -EsHome C:\workspace\tools\elasticsearch-8.10.4
param(
    [Parameter(Mandatory = $true)]
    [string]$EsHome,
    # 자바 힙 크기. PC 메모리가 넉넉하지 않으면 512m로 줄인다
    [string]$Heap = "1g"
)

$bin = Join-Path $EsHome "bin\elasticsearch.bat"
if (-not (Test-Path $bin)) {
    Write-Error "elasticsearch.bat을 찾지 못했습니다: $bin  (zip을 푼 폴더 경로를 -EsHome으로 넣으세요)"
    exit 1
}

# 한글 검색에 필요한 nori 분석기가 없으면 라운지 색인을 만들 수 없다
$nori = Join-Path $EsHome "plugins\analysis-nori"
if (-not (Test-Path $nori)) {
    Write-Warning "nori 분석기가 없습니다. 먼저 한 번 실행하세요: & `"$EsHome\bin\elasticsearch-plugin.bat`" install analysis-nori"
}

$env:ES_JAVA_OPTS = "-Xms$Heap -Xmx$Heap"
& $bin `
    "-Ecluster.name=avenue-dev" `
    "-Ediscovery.type=single-node" `
    "-Expack.security.enabled=false" `
    "-Expack.security.enrollment.enabled=false" `
    "-Expack.ml.enabled=false" `
    "-Enetwork.host=127.0.0.1" `
    "-Ehttp.port=9200"
