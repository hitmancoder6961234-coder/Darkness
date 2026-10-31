<#
.SYNOPSIS
  Creates the private "Script properties" for the Darkness admin login.
  No plaintext password is ever written to a file or stored in the repo.

.DESCRIPTION
  The password is read from the DARKNESS_ADMIN_PASSWORD environment variable (so it never appears in a script
  or in your command history) or, if that is not set, you are prompted for it securely.

  A random salt is generated and a salted PBKDF2-HMAC-SHA256 key is derived from the password. The result is
  printed as 5 name=value lines. Paste them into Apps Script:
      Project Settings (gear icon) > Script properties > Add script property
  Those properties are the server-side "environment variables": only you (the script owner) can see them.
  NEVER commit them to GitHub. The GitHub Pages site is public, so anything in the repo is public.

.PARAMETER Username
  The admin email/username. Defaults to the DARKNESS_ADMIN_USER environment variable, otherwise you are prompted.

.PARAMETER Iterations
  PBKDF2 iterations (default 1000). Apps Script is slow, so this stays low; the hash lives only in your private
  Script properties and is protected by the server-side lockout (5 wrong tries = 15 minute lock).

.PARAMETER OutFile
  Optional path to also save the 5 lines (keep it OUT of the repo; .secrets/ is git-ignored).

.EXAMPLE
  $env:DARKNESS_ADMIN_USER = "you@example.com"
  $env:DARKNESS_ADMIN_PASSWORD = "a long unique passphrase"
  .\tools\New-AdminHash.ps1 -OutFile ..\.secrets\apps-script-properties.txt
  Remove-Item Env:\DARKNESS_ADMIN_PASSWORD
#>
param(
    [string]$Username = $env:DARKNESS_ADMIN_USER,
    [int]$Iterations = 1000,
    [string]$OutFile
)
$ErrorActionPreference = "Stop"

function Get-Pbkdf2Sha256([byte[]]$Password, [byte[]]$Salt, [int]$Iter) {
    # Identical to the verification code in google-apps-script.js (single 32-byte block).
    $hmac = New-Object System.Security.Cryptography.HMACSHA256 (, $Password)
    try {
        $block = [byte[]]($Salt + [byte[]](0, 0, 0, 1))
        $u = $hmac.ComputeHash($block)
        $t = $u.Clone()
        for ($i = 1; $i -lt $Iter; $i++) {
            $u = $hmac.ComputeHash($u)
            for ($j = 0; $j -lt 32; $j++) { $t[$j] = $t[$j] -bxor $u[$j] }
        }
        return , $t
    }
    finally { $hmac.Dispose() }
}

if (-not $Username) { $Username = Read-Host "Admin email/username" }
$Username = $Username.Trim().ToLowerInvariant()
if (-not $Username) { throw "A username is required." }

$plain = $env:DARKNESS_ADMIN_PASSWORD
if (-not $plain) {
    $secure = Read-Host "Admin password (input hidden)" -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}
if (-not $plain) { throw "A password is required." }

$weak = @()
if ($plain.Length -lt 12) { $weak += "shorter than 12 characters" }
if ($plain -notmatch '[a-z]' -or $plain -notmatch '[A-Z]' -or $plain -notmatch '\d' -or $plain -notmatch '[^A-Za-z0-9]') { $weak += "missing lower/upper/digit/symbol variety" }
if ($weak.Count) { Write-Warning ("This password is weak (" + ($weak -join "; ") + "). Prefer a long unique passphrase, and never reuse your server/SSH password.") }

$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$salt = New-Object byte[] 16;  $rng.GetBytes($salt)
$secret = New-Object byte[] 32; $rng.GetBytes($secret)
$rng.Dispose()

$pwBytes = [Text.Encoding]::UTF8.GetBytes($plain)
$derived = Get-Pbkdf2Sha256 $pwBytes $salt $Iterations

# Cross-check against .NET's own PBKDF2 when available (proves the algorithm is the standard one).
try {
    $ref = New-Object Security.Cryptography.Rfc2898DeriveBytes($plain, $salt, $Iterations, [Security.Cryptography.HashAlgorithmName]::SHA256)
    $refBytes = $ref.GetBytes(32); $ref.Dispose()
    if ([Convert]::ToBase64String($refBytes) -ne [Convert]::ToBase64String($derived)) { throw "PBKDF2 self-check FAILED" }
    Write-Host "Self-check: matches .NET PBKDF2-HMAC-SHA256." -ForegroundColor DarkGray
}
catch [System.Management.Automation.MethodException] { Write-Host "Self-check skipped (older .NET)." -ForegroundColor DarkGray }

$lines = @(
    "ADMIN_USER=$Username",
    "ADMIN_SALT=$([Convert]::ToBase64String($salt))",
    "ADMIN_PASS_HASH=$([Convert]::ToBase64String($derived))",
    "ADMIN_ITER=$Iterations",
    "SESSION_SECRET=$([Convert]::ToBase64String($secret))"
)

Write-Host ""
Write-Host "Add these 5 Script properties in Apps Script (Project Settings > Script properties):" -ForegroundColor Cyan
$lines | ForEach-Object { Write-Host "  $_" }
Write-Host ""
Write-Host "Do NOT commit these to GitHub. Rotating SESSION_SECRET signs everyone out." -ForegroundColor Yellow

if ($OutFile) {
    $dir = Split-Path -Parent $OutFile
    if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force $dir | Out-Null }
    [IO.File]::WriteAllText($OutFile, (($lines -join "`r`n") + "`r`n"), (New-Object Text.UTF8Encoding($false)))
    Write-Host "Saved to $OutFile (keep this file private)." -ForegroundColor Green
}

# wipe the plaintext from memory/environment
$plain = $null; $pwBytes = $null
Remove-Item Env:\DARKNESS_ADMIN_PASSWORD -ErrorAction SilentlyContinue
