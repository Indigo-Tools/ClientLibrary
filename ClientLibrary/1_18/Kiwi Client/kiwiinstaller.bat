@echo off
goto permcheck

:permcheck
call :isAdmin
if %errorlevel% == 0 (
goto success
) else (
cls
echo try again but run as administrator
)

pause >nul
exit /b

:isAdmin
fsutil dirty query %systemdrive% >nul
exit /b

:success
:::              /@,      _  ___          _    _____ _ _            _
:::            .%@@@&#.  | |/ (_)        (_)  / ____| (_)          | |
:::        .*&&#,/@@@@*  | ' / ___      ___  | |    | |_  ___ _ __ | |_
:::      ,%@@@@&,/@@@@*  |  < | \ \ /\ / / | | |    | | |/ _ \ '_ \| __|
:::     /&@@@%(*#&@@@@*  | . \| |\ V  V /| | | |____| | |  __/ | | | |_ 
::: .#@@/,(*,#%@@@@@#    |_|\_\_| \_/\_/ |_|  \_____|_|_|\___|_| |_|\__| 
::: ,%@@@@@@@@@@@@@//   
:::   .(#######(/       
:::
:::Created By Wafwaf
:::Installer By Rice
for /f "delims=: tokens=*" %%A in ('findstr /b ::: "%~f0"') do @echo(%%A
pause
cls
echo BEFORE INSTALLING: Is Sideloading Apps or Developer Mode enabled?
set /p devmode=[Y]es/[N]o?
if /i "%devmode%" neq "Y" echo bro enable sideloading & ping localhost -n 3 > nul
if /i "%devmode%" neq "Y" start "" https://www.youtube.com/watch?v=qqIzTmPLjnk & exit
cls
rmdir /q /s C:\kiwi
cls
cd C:\ & mkdir C:\kiwi
echo Downloading Kiwi Client... (This will take a while, possibly more than 10 minutes)
echo 	[oo                                      ]
powershell -command "& {$ProgressPreference = 'SilentlyContinue'; Invoke-WebRequest -Uri 'https://github.com/KiwiClient/KiwiAppx/releases/download/kiwi/kiwi.appx' -OutFile 'C:\kiwi\kiwi.appx'}"
cls
echo Downloading Kiwi Client... (This will take a while, possibly more than 10 minutes)
echo 	[oooooooooo                              ]
ping localhost -n 2 > nul
cls
echo Downloading Kiwi Client... (This will take a while, possibly more than 10 minutes)
echo 	[oooooooooooooooooooo                    ]
ping localhost -n 2 > nul
cls
echo Downloading Kiwi Client... (This will take a while, possibly more than 10 minutes)
echo 	[oooooooooooooooooooooooooooooo          ]
ping localhost -n 2 > nul
cls
echo Downloading Kiwi Client... (This will take a while, possibly more than 10 minutes)
echo 	[oooooooooooooooooooooooooooooooooooooooo]
ping localhost -n 2 > nul
cls
echo Downloaded Kiwi Client!
ping localhost -n 2 > nul
cls
echo Downloading Certificate...
echo 	[oo                                      ]
ping localhost -n 2 > nul
cls
echo Downloading Certificate...
echo 	[oooooooooooooooooooooooooooooooooooooooo]
powershell -command "& {$ProgressPreference = 'SilentlyContinue'; Invoke-WebRequest -Uri 'https://github.com/KiwiClient/KiwiAppx/releases/download/kiwi/kiwi.cer' -OutFile 'C:\kiwi\kiwi.cer'}"
cls
echo Downloaded Certificate!
ping localhost -n 2 > nul
echo Signing Kiwi Client...
certutil -addstore -enterprise -f -v root "C:\kiwi\kiwi.cer"
cls
echo Signed Kiwi Client!
ping localhost -n 2 > nul
cls
echo Uninstalling Minecraft...
powershell -Command "& {Get-AppxPackage *minecraft* | Remove-AppxPackage -PreserveRoamableApplicationData}"
cls
echo Uninstalled Minecraft!
ping localhost -n 2 > nul
cls
echo Please Continue in the Install Window. This window will close.
pause
start C:\kiwi\kiwi.appx