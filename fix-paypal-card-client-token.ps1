$ErrorActionPreference = "Stop"

$path = Join-Path $PSScriptRoot "app\business-advertising\payment\page.tsx"

if (-not (Test-Path $path)) {
  throw "Could not find $path"
}

$backup = Join-Path $HOME ("Downloads\business-payment-client-token-backup-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".tsx")
Copy-Item $path $backup -Force

$content = [IO.File]::ReadAllText($path)

$openOld = @'
                <PayPalScriptProvider
                  options={{
'@

$openNew = @'
                {clientToken ? (
                  <PayPalScriptProvider
                    key={clientToken}
                    options={{
'@

if (-not $content.Contains($openOld)) {
  throw "The PayPalScriptProvider opening block was not found. No file was changed."
}

$content = $content.Replace($openOld, $openNew)

$closeOld = @'
                </PayPalScriptProvider>
'@

$closeNew = @'
                  </PayPalScriptProvider>
                ) : (
                  <p className="rounded-xl bg-black/5 p-4 text-center text-sm font-bold text-black/60">
                    Loading a fresh secure PayPal payment session...
                  </p>
                )}
'@

$closeIndex = $content.IndexOf($closeOld)
if ($closeIndex -lt 0) {
  throw "The PayPalScriptProvider closing block was not found. No file was changed."
}

$content = $content.Remove($closeIndex, $closeOld.Length).Insert($closeIndex, $closeNew)

[IO.File]::WriteAllText(
  $path,
  $content,
  (New-Object Text.UTF8Encoding($false))
)

Write-Host ""
Write-Host "Fixed PayPal hosted-card client-token initialization."
Write-Host "The PayPal SDK will now load only after a fresh client token exists."
Write-Host "Backup saved at:"
Write-Host $backup
Write-Host ""
Write-Host "Next command: npm run build"
