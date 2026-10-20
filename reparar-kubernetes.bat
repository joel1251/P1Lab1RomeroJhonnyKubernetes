@echo off
:: Este script debe ejecutarse como Administrador
echo ===================================================
echo   LIBERANDO PUERTO 6443 DE KUBERNETES EN WINDOWS
echo ===================================================
echo.
echo 1. Deteniendo winnat...
net stop winnat
echo.
echo 2. Iniciando winnat...
net start winnat
echo.
echo ===================================================
echo Exito! El puerto 6443 ha sido liberado.
echo Ahora ve a Docker Desktop y presiona "Restart" en Kubernetes,
echo o reinicia Docker Desktop.
echo ===================================================
pause
