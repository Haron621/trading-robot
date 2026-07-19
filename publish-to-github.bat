@echo off
setlocal

cd /d "%~dp0"

echo [1/3] Running tests...
node --test
if errorlevel 1 (
  echo Tests failed. Push cancelled.
  exit /b 1
)

echo [2/3] Configuring GitHub remote...
git remote set-url origin https://github.com/Haron621/trading-robot.git
if errorlevel 1 (
  echo Could not configure origin.
  exit /b 1
)

echo [3/3] Pushing master to GitHub...
git push -u origin master
if errorlevel 1 (
  echo Push failed.
  exit /b 1
)

echo Done.
endlocal
