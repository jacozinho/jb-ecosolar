[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string]$RepositoryUrl = 'https://github.com/jacozinho/jb-ecosolar.git',

    [string]$CommitMessage = 'chore: atualizar projeto'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

function Invoke-Git {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)

    & git @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Falha no comando: git $($Arguments -join ' ')"
    }
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw 'Git nao foi encontrado. Instale o Git antes de executar este script.'
}

if (-not (Test-Path (Join-Path $root '.git'))) {
    Write-Host 'Inicializando o repositorio Git...'
    Invoke-Git @('init')
}

Push-Location $root
try {
    $currentBranch = (& git branch --show-current).Trim()
    if (-not $currentBranch) {
        Invoke-Git @('checkout', '-b', 'main')
    } elseif ($currentBranch -ne 'main') {
        Invoke-Git @('branch', '-M', 'main')
    }

    $remoteNames = @(& git remote)
    if ($remoteNames -notcontains 'origin') {
        if ($RepositoryUrl -notmatch '^https://github\.com/[^/]+/[^/]+(?:\.git)?/?$') {
            throw 'URL invalida. Use o formato https://github.com/usuario/repositorio.git'
        }

        Invoke-Git @('remote', 'add', 'origin', $RepositoryUrl)
    } else {
        $remote = (& git remote get-url origin).Trim()
        if ($RepositoryUrl -and $remote -ne $RepositoryUrl) {
        Write-Host "Atualizando a URL do remote origin para $RepositoryUrl"
        Invoke-Git @('remote', 'set-url', 'origin', $RepositoryUrl)
        }
    }

    Write-Host 'Adicionando arquivos rastreaveis...'
    Invoke-Git @('add', '--all')

    $stagedFiles = @(git diff --cached --name-only)
    if ($stagedFiles.Count -eq 0) {
        Write-Host 'Nenhuma alteracao nova para enviar.'
    } else {
        Write-Host "Criando commit: $CommitMessage"
        Invoke-Git @('commit', '-m', $CommitMessage)
    }

    Write-Host 'Enviando para o GitHub...'
    Invoke-Git @('push', '--set-upstream', 'origin', 'main')
    Write-Host 'Repositorio atualizado com sucesso.'
}
finally {
    Pop-Location
}
