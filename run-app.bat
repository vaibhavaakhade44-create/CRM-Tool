@echo off
title BusinessOS CRM Launcher
echo ==============================================
echo   Starting BusinessOS CRM Stack
echo ==============================================

echo [1/3] Starting PostgreSQL...
start "CRM-Postgres" /min wsl -d Ubuntu -u root bash -c "service postgresql start && sleep infinity"

echo [2/3] Launching Backend API on http://localhost:5000...
start "CRM-Backend" cmd /k "cd /d \"d:\com code\CRM-Tool-main\backend\" && npm run dev"

echo [3/3] Launching Frontend UI on http://localhost:5173...
start "CRM-Frontend" cmd /k "cd /d \"d:\com code\CRM-Tool-main\frontend\" && npm run dev -- --host 0.0.0.0"

echo Waiting for services to initialize...
ping 127.0.0.1 -n 5 > nul

echo Opening browser...
start http://localhost:5173

echo Done!
