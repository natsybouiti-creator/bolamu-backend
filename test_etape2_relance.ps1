$token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6OSwicGhvbmUiOiIrMjQyMDY2MjI2MTE2Iiwicm9sZSI6InBoYXJtYWNpZSIsImlzX2FjdGl2ZSI6dHJ1ZSwiYmFubmVkIjpmYWxzZSwiaWF0IjoxNzc3NDI3NzkxLCJleHAiOjE3NzgwMzI1OTF9.Vc4kSKqFLBszt0qXWHNQsqs7mYbDxPr7JEpSfmZgfdo"
$body2 = '{"patient_phone": "+242069735418", "montant_total": 10000}'

try {
    $response2 = Invoke-RestMethod -Uri "https://api.bolamu.co/api/v1/tiers-payant/initier" -Method POST -ContentType "application/json" -Headers @{"Authorization" = "Bearer $token"} -Body $body2
    $response2 | ConvertTo-Json -Depth 4
    if ($response2.data) {
        Write-Host "`nTRANSACTION_ID: $($response2.data.transaction_id)"
    }
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
