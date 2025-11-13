@echo off
echo ================================
echo Microservices Demo - Quick Start
echo ================================
echo.

echo Checking if Docker is running...
docker info > nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Docker is not running!
    echo Please start Docker Desktop and try again.
    pause
    exit /b 1
)

echo Docker is running!
echo.

:menu
echo What would you like to do?
echo.
echo 1. Start in Development Mode (with hot-reload)
echo 2. Start in Production Mode
echo 3. Stop all services
echo 4. Clean all containers and images
echo 5. Install dependencies locally
echo 6. Exit
echo.

set /p choice="Enter your choice (1-6): "

if "%choice%"=="1" goto dev
if "%choice%"=="2" goto prod
if "%choice%"=="3" goto stop
if "%choice%"=="4" goto clean
if "%choice%"=="5" goto install
if "%choice%"=="6" goto end
goto menu

:dev
echo.
echo Starting in Development Mode...
echo This will take a few minutes on first run...
docker-compose -f docker-compose.dev.yml up --build
goto end

:prod
echo.
echo Starting in Production Mode...
echo This will take a few minutes on first run...
docker-compose up --build
goto end

:stop
echo.
echo Stopping all services...
docker-compose down
docker-compose -f docker-compose.dev.yml down
echo Services stopped!
pause
goto menu

:clean
echo.
echo WARNING: This will remove all containers, images, and volumes!
set /p confirm="Are you sure? (y/n): "
if /i "%confirm%"=="y" (
    docker-compose down -v --rmi all
    docker-compose -f docker-compose.dev.yml down -v --rmi all
    echo Cleanup complete!
) else (
    echo Cleanup cancelled.
)
pause
goto menu

:install
echo.
echo Installing dependencies for all services...
cd services\rest-api && npm install && cd ..\..
cd services\graphql-api && npm install && cd ..\..
cd api-gateway && npm install && cd ..\..
cd frontend-app && npm install && cd ..
echo.
echo All dependencies installed!
pause
goto menu

:end
echo.
echo Bye!
pause