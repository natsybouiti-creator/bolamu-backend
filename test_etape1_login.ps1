$body = '{"phone": "+242066226116", "password": "WR383LMW"}'
try {
    $response = Invoke-RestMethod -Uri "https://bolamu-backend.onrender.com/api/v1/auth/login" -Method POST -ContentType "application/json" -Body $body
    $response | ConvertTo-Json -Depth 4
    Write-Host "`nTOKEN: $($response.token)"
} catch {
    Write-Host "❌ ERREUR: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $reader.BaseStream.Position = 0
        $reader.DiscardBufferedData()
        $errorBody = $reader.ReadToEnd()
        Write-Host "`nRéponse d'erreur: $errorBody"
    }
}
