# Loads the governed staging synthetic fixture credential from the
# DPAPI-protected artifact and exports it as environment variables for the
# Playwright browser acceptance harness. Never prints the password.
#
# This script only works on the machine/user account that created the
# protected artifact (Windows DPAPI CurrentUser scope) — it cannot be used to
# extract the credential elsewhere, and it never touches production data.
#
# Usage:
#   . .\scripts\load-fixture-credential.ps1
#   npm run test:browser
param(
  [string]$ArtifactPath = "C:\CoreCare\.secure-fixture-credentials\one-login-mobile-20260811.json"
)

if (-not (Test-Path $ArtifactPath)) {
  throw "Protected fixture credential artifact not found at $ArtifactPath"
}

$artifact = Get-Content $ArtifactPath -Raw | ConvertFrom-Json

# The protected credential blob is created by the governed fixture script via
# PowerShell's ConvertTo-SecureString/ConvertFrom-SecureString (DPAPI CurrentUser,
# UTF-16LE internal representation) -- NOT raw System.Security.Cryptography.ProtectedData.
# Decrypting with the wrong method silently yields a corrupted password.
$secure = ConvertTo-SecureString $artifact.protectedCredential
$bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
  $password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
} finally {
  [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}

$env:CORECARE_FIXTURE_EMAIL = $artifact.email
$env:CORECARE_FIXTURE_PASSWORD = $password

Write-Output "Loaded fixture credential for $($artifact.email) into environment (password not displayed)."
