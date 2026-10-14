<#
.SYNOPSIS
  Demonstrates that the safety gate is enforced by the SERVER, not by the web page.

.DESCRIPTION
  Talks to the REST API directly (no browser, no front-end code involved) and walks the
  "air conditioner stops working" state machine up to the circuit-breaker step, which is a
  safety-critical instruction state:

    1  GET  /health                          -> status is "ok"
    2  POST /traversal/sessions              -> 2xx and a sessionId
    3  POST .../actions  answer yes (x2)     -> current state is n_fix_breaker and
                                                requiresSafetyConfirmation is true
    4  POST .../actions  continue            -> 400 with code SAFETY_CONFIRMATION_REQUIRED
    5  GET  /traversal/sessions/:id          -> state is STILL n_fix_breaker (rejection did not move it)
    6  POST .../actions  confirm_safety      -> 2xx and the state has changed

  Step 6 matters: a gate that blocks everything would also "pass" step 4. The gate must let
  the user through when the warning is confirmed in the correct way.

  The script does NOT delete the session. The session_history table is the strongest evidence
  (a rejected action must leave no row), so read it first with:
      node scripts/show-session-history.js <sessionId>
  and only then delete the test session.

  Exit code: 0 when every step passed, 1 otherwise.

  NOTE: this creates a real session (rows in sessions / session_history) in whatever database
  the target server is connected to.

  Works in Windows PowerShell 5.1 and PowerShell 7. Messages are ASCII only on purpose: 5.1 reads
  a UTF-8 file without BOM as ANSI and would garble Thai text.

.EXAMPLE
  ./scripts/demo-safety-gate.ps1
  ./scripts/demo-safety-gate.ps1 -BaseUrl https://appliance-repair-assistant.onrender.com
#>
param(
  [string]$BaseUrl = 'http://localhost:3000',
  [string]$GraphId = 'samsung_ac_ar70h_stops_working'
)

# Windows PowerShell 5.1 may default to TLS 1.0/1.1, which https hosts (Render) reject.
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$ErrorActionPreference = 'Stop'
$base = $BaseUrl.TrimEnd('/')
$failures = 0

function Send-Api {
  # Returns Status (int), Json (object or $null) and Raw (text) for ANY status code.
  # Invoke-WebRequest throws on non-2xx, so the error branch reads the status and the body
  # from the exception: that is exactly where the 400 of step 4 arrives.
  param([string]$Method, [string]$Path, $Body = $null)

  # not named $args: that is a PowerShell automatic variable
  $request = @{ Uri = "$base$Path"; Method = $Method; UseBasicParsing = $true }
  if ($null -ne $Body) {
    $request.Body = ($Body | ConvertTo-Json -Compress)
    $request.ContentType = 'application/json; charset=utf-8'
  }

  $encoding = ''
  try {
    $r = Invoke-WebRequest @request
    $status = [int]$r.StatusCode
    $raw = [string]$r.Content
  } catch {
    $resp = $_.Exception.Response
    if ($null -eq $resp) { throw }   # no HTTP response at all (server down, DNS, TLS ...)
    $status = [int]$resp.StatusCode
    $encoding = [string]$resp.Headers['Content-Encoding']

    # Where the error body can be read from depends on the host: on some responses (seen
    # against Render behind Cloudflare, Windows PowerShell 5.1) ErrorDetails.Message is empty
    # while the response stream is readable, and on others (localhost) the cmdlet already
    # consumed the stream and ErrorDetails.Message holds the body. Try the stream, then fall back.
    $raw = ''
    try {
      $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
      $raw = [string]$reader.ReadToEnd()
      $reader.Close()
    } catch { $raw = '' }
    if (-not $raw) { $raw = [string]$_.ErrorDetails.Message }
  }

  $json = $null
  if ($raw) { try { $json = $raw | ConvertFrom-Json } catch { $json = $null } }
  return [pscustomobject]@{ Status = $status; Json = $json; Raw = $raw; Encoding = $encoding }
}

function Report-Step {
  param([int]$Number, [string]$Name, [bool]$Passed, [string]$Detail)
  $tag = if ($Passed) { 'PASS' } else { 'FAIL' }
  Write-Host ("[{0}] step {1}: {2} -- {3}" -f $tag, $Number, $Name, $Detail)
  if (-not $Passed) { $script:failures++ }
}

Write-Host "Target: $base   Graph: $GraphId"
Write-Host ("Started: " + (Get-Date).ToUniversalTime().ToString('yyyy-MM-dd HH:mm:ss') + " UTC")
Write-Host ''

# ---- 1 health ----
$health = Send-Api 'GET' '/health'
Report-Step 1 'GET /health is ok' ($health.Status -eq 200 -and $health.Json.status -eq 'ok') ("HTTP $($health.Status), status=$($health.Json.status)")
if ($health.Json.status -ne 'ok') {
  Write-Host 'Stopping: server is not healthy (status is not "ok"; a "degraded" value means the database is unreachable).'
  exit 1
}

# ---- 2 start session ----
$start = Send-Api 'POST' '/traversal/sessions' @{ graphId = $GraphId }
$sessionId = $start.Json.sessionId
Report-Step 2 'POST /traversal/sessions returns 2xx and a sessionId' (($start.Status -ge 200 -and $start.Status -lt 300) -and [bool]$sessionId) ("HTTP $($start.Status), node=$($start.Json.node.nodeId)")
if (-not $sessionId) {
  Write-Host "Stopping: no session was created. Body: $($start.Raw)"
  exit 1
}
Write-Host "SESSION_ID=$sessionId"

# ---- 3 walk to the safety-critical state ----
$a1 = Send-Api 'POST' "/traversal/sessions/$sessionId/actions" @{ type = 'answer'; value = 'yes' }
$a2 = Send-Api 'POST' "/traversal/sessions/$sessionId/actions" @{ type = 'answer'; value = 'yes' }
$atGate = ($a1.Status -ge 200 -and $a1.Status -lt 300) -and ($a2.Status -ge 200 -and $a2.Status -lt 300) `
  -and ($a2.Json.node.nodeId -eq 'n_fix_breaker') -and ($a2.Json.node.requiresSafetyConfirmation -eq $true)
Report-Step 3 'two "answer yes" reach n_fix_breaker with requiresSafetyConfirmation=true' $atGate ("HTTP $($a1.Status)/$($a2.Status), node=$($a2.Json.node.nodeId), requiresSafetyConfirmation=$($a2.Json.node.requiresSafetyConfirmation)")
if (-not $atGate) {
  Write-Host 'Stopping: could not reach the safety-critical state, so the gate cannot be tested.'
  Write-Host "SESSION_ID=$sessionId"
  exit 1
}

# ---- 4 try to skip the warning ----
$skip = Send-Api 'POST' "/traversal/sessions/$sessionId/actions" @{ type = 'continue' }
$skipOk = ($skip.Status -eq 400) -and ($skip.Json.code -eq 'SAFETY_CONFIRMATION_REQUIRED')
$skipDetail = "HTTP $($skip.Status), code=$($skip.Json.code)"
if (-not $skipOk) {
  # diagnostics only when the step fails: what did the server actually send back?
  $preview = if ($skip.Raw) { $skip.Raw.Substring(0, [Math]::Min(80, $skip.Raw.Length)) } else { '' }
  $skipDetail += ", content-encoding='$($skip.Encoding)', body-starts-with='$preview'"
}
Report-Step 4 '"continue" without confirming is rejected with 400 SAFETY_CONFIRMATION_REQUIRED' $skipOk $skipDetail

# ---- 5 the rejection must not have moved the state ----
$after = Send-Api 'GET' "/traversal/sessions/$sessionId"
Report-Step 5 'state is still n_fix_breaker after the rejected action' (($after.Status -eq 200) -and ($after.Json.node.nodeId -eq 'n_fix_breaker')) ("HTTP $($after.Status), node=$($after.Json.node.nodeId)")

# ---- 6 confirming the warning must let the user through ----
$confirm = Send-Api 'POST' "/traversal/sessions/$sessionId/actions" @{ type = 'confirm_safety' }
$moved = ($confirm.Status -ge 200 -and $confirm.Status -lt 300) -and ($confirm.Json.node.nodeId -ne 'n_fix_breaker') -and [bool]$confirm.Json.node.nodeId
Report-Step 6 '"confirm_safety" is accepted and the state moves on' $moved ("HTTP $($confirm.Status), node=$($confirm.Json.node.nodeId)")

Write-Host ''
Write-Host ("Finished: " + (Get-Date).ToUniversalTime().ToString('yyyy-MM-dd HH:mm:ss') + " UTC")
Write-Host "SESSION_ID=$sessionId"
if ($failures -eq 0) {
  Write-Host 'RESULT: all 6 steps passed'
  Write-Host "Next: node scripts/show-session-history.js $sessionId   (expected: 3 rows, no row for 'continue')"
  exit 0
}
Write-Host "RESULT: $failures step(s) FAILED"
exit 1
