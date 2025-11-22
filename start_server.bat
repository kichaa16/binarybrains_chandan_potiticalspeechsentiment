@echo off
echo Starting PolitiSent Server...
echo.

REM Check if node is in PATH
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Node not found in PATH. Checking standard locations...
    if exist "C:\Program Files\nodejs\node.exe" (
        set "PATH=%PATH%;C:\Program Files\nodejs"
    ) else (
        echo Node.js not found. Please install Node.js.
        pause
        exit /b
    )
)

echo Once the server starts, open your browser and go to:
echo http://localhost:8081
echo.

REM Run http-server from node_modules
call node "node_modules/http-server/bin/http-server" -p 8081

pause
