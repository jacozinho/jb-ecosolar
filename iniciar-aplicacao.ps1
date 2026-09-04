$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontend = Join-Path $root 'frontend'
$backend = Join-Path $root 'backend'

function Install-DependenciesIfNeeded {
    param([string]$ProjectPath)

    if (-not (Test-Path (Join-Path $ProjectPath 'node_modules'))) {
        Write-Host "Instalando dependencias em $ProjectPath..."
        Push-Location $ProjectPath
        try {
            npm ci
        }
        finally {
            Pop-Location
        }
    }
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw 'Node.js e npm nao foram encontrados. Instale o Node.js antes de continuar.'
}

Install-DependenciesIfNeeded $frontend
Install-DependenciesIfNeeded $backend

if ($env:NODE_ENV -eq 'production') {
    Push-Location $frontend
    try { npm run build }
    finally { Pop-Location }
    Start-Process -FilePath 'powershell.exe' -WorkingDirectory $backend -ArgumentList '-NoExit', '-Command', 'npm start'
    Start-Process -FilePath 'powershell.exe' -WorkingDirectory $frontend -ArgumentList '-NoExit', '-Command', 'npm start'
    Write-Host 'Aplicacao iniciada em modo de producao.'
    exit 0
}

Start-Process -FilePath 'powershell.exe' -WorkingDirectory $backend -ArgumentList '-NoExit', '-Command', 'npm run dev'
Start-Process -FilePath 'powershell.exe' -WorkingDirectory $frontend -ArgumentList '-NoExit', '-Command', 'npm run dev'

Write-Host 'Aplicacao iniciada.'
Write-Host 'Frontend: http://localhost:3000'
Write-Host 'Backend:  http://localhost:4000/api/health'