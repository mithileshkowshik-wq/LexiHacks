param(
    [Parameter(Mandatory = $true)][ValidatePattern('^[a-z][a-z0-9-]{4,28}[a-z0-9]$')][string]$ProjectId,
    [string]$Region = 'us-central1',
    [string]$Service = 'lexipath',
    [ValidatePattern('^[1-9][0-9]*$')][string]$SecretVersion = '1'
)
$ErrorActionPreference = 'Stop'
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) { throw 'Install the Google Cloud CLI and run gcloud auth login first.' }
$repo = Split-Path -Parent $PSScriptRoot
$runtimeAccount = "lexipath-runtime@$ProjectId.iam.gserviceaccount.com"
$builderAccount = "projects/$ProjectId/serviceAccounts/lexipath-builder@$ProjectId.iam.gserviceaccount.com"
$bucket = "$ProjectId-lexipath-scans"
foreach ($secret in @('lexipath-mongodb-uri', 'lexipath-gemini-api-key', 'lexipath-jwt-secret')) {
    $state = & gcloud secrets versions describe $SecretVersion "--secret=$secret" "--project=$ProjectId" '--format=value(state)'
    if ($LASTEXITCODE -ne 0 -or $state -ne 'ENABLED') { throw "Add an enabled version $SecretVersion of $secret in Secret Manager before deploying." }
}
$secretBindings = "MONGODB_URI=lexipath-mongodb-uri:$SecretVersion,GEMINI_API_KEY=lexipath-gemini-api-key:$SecretVersion,JWT_SECRET=lexipath-jwt-secret:$SecretVersion"
$arguments = @(
    'run', 'deploy', $Service,
    "--project=$ProjectId", "--region=$Region", "--source=$repo",
    "--service-account=$runtimeAccount", "--build-service-account=$builderAccount",
    "--env-vars-file=$(Join-Path $repo 'deploy\cloud-run.env.yaml')",
    "--set-secrets=$secretBindings",
    '--port=8080', '--execution-environment=gen2',
    '--cpu=1', '--memory=2Gi', '--concurrency=4', '--timeout=300',
    '--min=1', '--max=1', '--max-instances=1', '--no-cpu-throttling',
    '--network=lexipath-network', '--subnet=lexipath-subnet', '--vpc-egress=all-traffic',
    "--add-volume=mount-path=/app/server/samples,type=cloud-storage,bucket=$bucket,mount-options=uid=1000;gid=1000",
    '--startup-probe=httpGet.path=/healthz,httpGet.port=8080,timeoutSeconds=5,periodSeconds=10,failureThreshold=24',
    '--allow-unauthenticated'
)
# Public access reaches the sign-in page; feature APIs still require the app JWT.
& gcloud @arguments
if ($LASTEXITCODE -ne 0) { throw 'Cloud Run build or deployment failed. Check the message above.' }
$url = & gcloud run services describe $Service "--project=$ProjectId" "--region=$Region" '--format=value(status.url)'
if ($LASTEXITCODE -ne 0 -or -not $url) { throw 'Could not retrieve the deployed URL.' }
& gcloud run services update $Service "--project=$ProjectId" "--region=$Region" "--update-env-vars=CLIENT_URL=$url"
if ($LASTEXITCODE -ne 0) { throw 'The app deployed, but its CLIENT_URL setting could not be updated.' }
Write-Host "Website: $url"
Write-Host 'Create your cloud login with scripts/create-cloud-account.ps1. The local demo login is not seeded into the cloud database.'
