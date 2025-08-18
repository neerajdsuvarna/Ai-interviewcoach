@REM @echo off
@REM echo Starting Interview Coach Development Environment...
@REM echo.

@REM echo Starting Flask Backend...
@REM start "Flask Backend" cmd /k "cd backend && python app.py"

@REM echo Waiting for backend to start...
@REM timeout /t 3 /nobreak >nul

@REM echo Starting React Frontend...
@REM cd frontend
@REM start "React Frontend" cmd /k "npm run dev"

@REM echo.
@REM echo Development servers are starting...
@REM echo Backend: http://localhost:5000
@REM echo Frontend: http://localhost:5173 (or check terminal for actual port)
@REM echo.
@REM echo Press any key to stop all servers...
@REM pause >nul

@REM echo Stopping servers...
@REM taskkill /f /im python.exe >nul 2>&1
@REM taskkill /f /im node.exe >nul 2>&1
@REM echo Servers stopped. 
@echo off
echo =========================================
echo   Starting Interview Coach Dev Environment
echo =========================================
echo.

REM Step 1: Install dependencies
echo Running install_dependencies.bat...
call install_dependencies.bat
echo.

REM Step 2: Start Supabase safely
echo Checking Supabase status...
cd supabase
for /f "tokens=* USEBACKQ" %%F in (`supabase status 2^>nul`) do (
    echo %%F | find /i "Stopped" >nul
    if not errorlevel 1 (
        echo Supabase is not running. Attempting to start...
        supabase start --debug
        if errorlevel 1 (
            echo Supabase start failed. Trying to remove old containers...
            docker ps -a --filter "name=supabase" --format "{{.ID}}" | findstr . >nul
            if not errorlevel 1 (
                for /f "delims=" %%C in ('docker ps -a --filter "name=supabase" --format "{{.ID}}"') do (
                    echo Removing container %%C
                    docker rm -f %%C
                )
            )
            echo Retrying Supabase start...
            supabase start
        )
    ) else (
        echo Supabase is already running.
    )
)
echo.

REM Step 3: Serve Supabase functions
echo Starting Supabase functions serve...
start "Supabase Functions" cmd /k "cd supabase && supabase functions serve --no-verify-jwt --debug"
timeout /t 3 /nobreak >nul
cd ..

REM Step 4: Start Flask Backend in test1 environment
echo Starting Flask Backend (test1)...
start "Flask Backend" cmd /k "cd backend && ..\test1\Scripts\activate && python app.py"
timeout /t 3 /nobreak >nul

REM Step 5: Start React Frontend
echo Starting React Frontend...
cd frontend
start "React Frontend" cmd /k "npm run dev"
cd ..

echo.
echo =========================================
echo Development servers are starting...
echo Backend:  http://localhost:5000
echo Frontend: http://localhost:5173 (check terminal for actual port)
echo =========================================
echo.
echo Press any key to stop all servers...
pause >nul

echo Stopping servers...
taskkill /f /im python.exe >nul 2>&1
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im deno.exe >nul 2>&1
echo Servers stopped.
