$ErrorActionPreference='Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Threading;
public static class RavenJobPower {
 [DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint flags);
 public static void WaitForEnd(EventWaitHandle stop) {
  var closed = new ManualResetEvent(false);
  var reader = new Thread(() => { try { while(Console.ReadLine() != null) {} } finally { closed.Set(); } });
  reader.IsBackground = true;
  reader.Start();
  WaitHandle.WaitAny(new WaitHandle[] {closed, stop});
 }
}
'@
$stopEvent=[Threading.EventWaitHandle]::new($false,[Threading.EventResetMode]::ManualReset,('Local\RavenJobAwake-'+$PID))
try{
 if([RavenJobPower]::SetThreadExecutionState([uint32]2147483649) -eq 0){throw 'Unable to request system wakefulness.'}
 [Console]::WriteLine('Raven job sleep hold active.')
 # EOF releases on completion/crash; the named event lets the owner stop it.
 [RavenJobPower]::WaitForEnd($stopEvent)
}finally{
 [void][RavenJobPower]::SetThreadExecutionState([uint32]2147483648)
 $stopEvent.Dispose()
}
