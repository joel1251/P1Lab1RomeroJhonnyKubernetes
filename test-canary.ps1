# Script para monitorear el Canary Deployment en tiempo real
# Muestra el porcentaje de tráfico entre la versión Estable (v2) y la versión Canary (v3)
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  MONITOREO DE CANARY DEPLOYMENT          " -ForegroundColor Yellow
Write-Host "  Presiona Ctrl+C para detener            " -ForegroundColor Gray
Write-Host "==========================================" -ForegroundColor Cyan

$stats = @{ "v2" = 0; "v3-canary" = 0; "otros" = 0 }
$total = 0

while ($true) {
    try {
        $r = Invoke-RestMethod -Uri "http://localhost:30080/api/info" -TimeoutSec 2
        $total++
        $hora = Get-Date -Format "HH:mm:ss.fff"
        
        if ($r.version -eq "v3-canary" -or $r.version -eq "v3") {
            $stats["v3-canary"]++
            Write-Host "[$hora] CANARY  --> Versión: $($r.version) | Pod: $($r.pod)" -ForegroundColor Yellow
        } else {
            $stats["v2"]++
            Write-Host "[$hora] ESTABLE --> Versión: $($r.version) | Pod: $($r.pod)" -ForegroundColor Green
        }

        if ($total % 10 -eq 0) {
            $pctCanary = [math]::Round(($stats["v3-canary"] / $total) * 100, 1)
            $pctStable = [math]::Round(($stats["v2"] / $total) * 100, 1)
            Write-Host "--- Total: $total reqs | Estable: $pctStable% | Canary: $pctCanary% ---" -ForegroundColor Cyan
        }
    }
    catch {
        $hora = Get-Date -Format "HH:mm:ss.fff"
        Write-Host "[$hora] ERROR al conectar" -ForegroundColor Red
    }
    Start-Sleep -Milliseconds 400
}
