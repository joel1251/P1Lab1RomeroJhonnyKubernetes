# Script para probar Idempotencia en Pagos distribuidos
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  PRUEBA DE IDEMPOTENCIA EN SISTEMAS DISTRIBUIDOS      " -ForegroundColor Yellow
Write-Host "======================================================" -ForegroundColor Cyan

# 1. Generar un Idempotency Key único (simulando una transacción de compra)
$idempotencyKey = "PAY-" + [guid]::NewGuid().ToString().Substring(0, 8)
Write-Host "`n1. Clave de Idempotencia generada: $idempotencyKey" -ForegroundColor White

$body1 = @{
    idempotencyKey = $idempotencyKey
    amount = 50.00
    currency = "USD"
    customer = "Jhonny Romero"
} | ConvertTo-Json

Write-Host "Enviando primera solicitud de pago..." -ForegroundColor Gray
$response1 = Invoke-RestMethod -Uri "http://localhost:30080/api/payment" -Method POST -Body $body1 -ContentType "application/json"
Write-Host "Resultado del primer intento:" -ForegroundColor Green
$response1 | Format-List

# 2. Reintentar con exactamente la misma clave (simulando doble clic o reintento de red)
Write-Host "`n2. Simulando REINTENTO con la misma clave ($idempotencyKey)..." -ForegroundColor Yellow
$response2 = Invoke-RestMethod -Uri "http://localhost:30080/api/payment" -Method POST -Body $body1 -ContentType "application/json"
Write-Host "Resultado del segundo intento (Detección de duplicado):" -ForegroundColor Magenta
$response2 | Format-List

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "Demostración finalizada con éxito." -ForegroundColor Green
