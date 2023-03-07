set /A numClients = %1
set /A low = %2
set /A mid = %3
set /A high = %4
set /A delay = %5
set /A testDuration = %6

echo script params: %numClients% %low% %mid% %high% %delay% %testDuration%
cat /dev/null > loadTestReport.txt
FOR /L %%i IN (1, 1, %numClients%) Do start /b node LoadTesting\LoadTestClient.js %low% %mid% %high% %delay% %testDuration% &