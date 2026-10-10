@echo off
chcp 65001 >nul
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-DSH.ps1" -CloseDsh -RestartDsh
if errorlevel 1 (
  echo 安装失败，请查看上方提示。
) else (
  echo 安装完成，请在DSH会话输入区打开API来源切换。
)
pause
