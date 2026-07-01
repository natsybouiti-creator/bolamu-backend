param(
    [Parameter(Mandatory=$true)]
    [string[]]$Scenarios
)

$ArtifactsDir = "artifacts"
$ContractsDir = "contracts"
New-Item -ItemType Directory -Force -Path $ArtifactsDir | Out-Null

$PassList = @()
$FailList = @()
$AmbiguousList = @()

foreach ($SC in $Scenarios) {
    Write-Host "=== $SC : lancement Playwright ==="

    $ContractPath = Join-Path $ContractsDir "${SC}_contract.json"
    if (-not (Test-Path $ContractPath)) {
        Write-Host "PAS DE CONTRAT -> $SC SAUTE"
        $AmbiguousList += "$SC (pas de contrat)"
        continue
    }

    $ScLower = $SC.ToLower()
    $SpecFile = Get-ChildItem "tests/e2e/${ScLower}-*.spec.js" -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Name

    if (-not $SpecFile) {
        Write-Host "FICHIER SPEC INTROUVABLE -> $SC FAIL"
        $FailList += "$SC (spec introuvable)"
        continue
    }
    Write-Host "Fichier resolu : $SpecFile"

    $env:DOTENV_CONFIG_QUIET = "true"
    $RawOutput = & npx playwright test $SpecFile --project=soins --reporter=json 2>&1
    $Lines = $RawOutput -split "`n"
    $JsonStartIndex = 0
    for ($i = 0; $i -lt $Lines.Count; $i++) {
        if ($Lines[$i].Trim().StartsWith("{")) {
            $JsonStartIndex = $i
            break
        }
    }
    $CleanJson = ($Lines[$JsonStartIndex..($Lines.Count - 1)] -join "`n")

    $RunJsonPath = Join-Path $ArtifactsDir "${SC}_run.json"
    $Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($RunJsonPath, $CleanJson, $Utf8NoBom)

    $ParsedForErrors = node scripts\check-playwright-errors.js $RunJsonPath
    if ($ParsedForErrors -match "^HAS_ERRORS") {
        Write-Host "PLAYWRIGHT A RETOURNE UNE ERREUR -> $SC FAIL"
        Write-Host $ParsedForErrors
        $FailList += "$SC (erreur Playwright : aucun test trouve ou execute)"
        continue
    }

    $JsonCheck = node scripts\check-json-valid.js $RunJsonPath
    if ($JsonCheck -notmatch "^VALID") {
        Write-Host "JSON INVALIDE -> $SC FAIL"
        Write-Host "Detail : $JsonCheck"
        $FailList += "$SC (JSON Playwright invalide)"
        continue
    }
    Write-Host "JSON valide confirme."

    Write-Host "=== $SC : verification deterministe (DB + contrat) ==="
    node verify_scenario.js $SC
    $VerifyExitCode = $LASTEXITCODE

    if ($VerifyExitCode -eq 0) {
        Write-Host "PASS : $SC"
        $PassList += $SC
    } else {
        $VerdictPath = Join-Path $ArtifactsDir "${SC}_verdict.json"
        $Status = node scripts\read-verdict-status.js $VerdictPath
        if ($Status -match "AMBIGUOUS") {
            Write-Host "AMBIGUOUS : $SC"
            $AmbiguousList += $SC
        } else {
            Write-Host "FAIL : $SC"
            $FailList += $SC
        }
    }
    Write-Host ""
}

Write-Host "================= BILAN DE BOUCLE ================="
Write-Host ("PASS      : " + ($PassList -join ", "))
Write-Host ("FAIL      : " + ($FailList -join ", "))
Write-Host ("AMBIGUOUS : " + ($AmbiguousList -join ", "))
Write-Host "====================================================="
Write-Host ""
Write-Host "Seuls les scenarios PASS peuvent etre committes."
Write-Host "Pour les FAIL/AMBIGUOUS, coller artifacts\<SC>_verdict.json brut."
