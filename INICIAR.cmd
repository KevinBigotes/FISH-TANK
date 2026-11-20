@echo off
setlocal
cd /d "%~dp0"
set "FISH_TANK_NODE="
for /f "delims=" %%N in ('where node.exe 2^>nul') do if not defined FISH_TANK_NODE set "FISH_TANK_NODE=%%N"
if not defined FISH_TANK_NODE if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "FISH_TANK_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not defined FISH_TANK_NODE (
  echo No se encontro Node.js. Instala Node.js 24 o posterior desde https://nodejs.org/
  pause
  exit /b 1
)
"%FISH_TANK_NODE%" "%~dp0scripts\local.mjs" %*
set "FISH_TANK_RESULT=%ERRORLEVEL%"
if not "%FISH_TANK_RESULT%"=="0" pause
exit /b %FISH_TANK_RESULT%
