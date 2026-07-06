# Script PowerShell pour exporter le schéma Neon
# ==========================================
# PRÉREQUIS : PostgreSQL avec pg_dump installé
# Installation Windows : https://www.postgresql.org/download/windows/
# Après installation, ajouter le bin PostgreSQL au PATH système

# Lire DATABASE_URL depuis .env
$envContent = Get-Content .env -ErrorAction SilentlyContinue
$databaseUrl = $null

foreach ($line in $envContent) {
    if ($line -match '^DATABASE_URL=(.+)$') {
        $databaseUrl = $matches[1]
        break
    }
}

if (-not $databaseUrl) {
    Write-Error "DATABASE_URL non trouvé dans .env"
    exit 1
}

# Créer le répertoire database si nécessaire
if (-not (Test-Path "database")) {
    New-Item -ItemType Directory -Path "database" | Out-Null
}

# Vérifier que pg_dump est disponible
$pgDumpCheck = Get-Command pg_dump -ErrorAction SilentlyContinue
if (-not $pgDumpCheck) {
    Write-Error "pg_dump n'est pas installé ou pas dans PATH"
    Write-Host "Installation requise :"
    Write-Host "1. Télécharger PostgreSQL : https://www.postgresql.org/download/windows/"
    Write-Host "2. Installer pg_dump (inclus dans PostgreSQL)"
    Write-Host "3. Ajouter C:\Program Files\PostgreSQL\{version}\bin au PATH"
    exit 1
}

# Exécuter pg_dump
Write-Host "Export du schéma Neon vers database/schema_reference.sql..."
pg_dump --schema-only --no-owner --no-acl -d $databaseUrl -f database/schema_reference.sql

if ($LASTEXITCODE -eq 0) {
    Write-Host "Export réussi : database/schema_reference.sql"
} else {
    Write-Error "Erreur pg_dump (code $LASTEXITCODE)"
    exit 1
}
