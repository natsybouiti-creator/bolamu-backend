$token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6OSwicGhvbmUiOiIrMjQyMDY2MjI2MTE2Iiwicm9sZSI6InBoYXJtYWNpZSIsImlzX2FjdGl2ZSI6dHJ1ZSwiYmFubmVkIjpmYWxzZSwiaWF0IjoxNzc3NDI3NzkxLCJleHAiOjE3NzgwMzI1OTF9.Vc4kSKqFLBszt0qXWHNQsqs7mYbDxPr7JEpSfmZgfdo"
$transactionId = 3

try {
    $response3 = Invoke-RestMethod -Uri "https://api.bolamu.co/api/v1/tiers-payant/$transactionId/valider" -Method PATCH -Headers @{"Authorization" = "Bearer $token"}
    $response3 | ConvertTo-Json -Depth 4
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
