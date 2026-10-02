param(
    [Parameter(Mandatory = $true)][ValidatePattern('^[a-z][a-z0-9-]{4,28}[a-z0-9]$')][string]$ProjectId,
    [string]$Region = 'us-central1'
)
$ErrorActionPreference = 'Stop'
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) { throw 'Install the Google Cloud CLI and run gcloud auth login first.' }
function Invoke-Cloud([string[]]$Arguments) {
    & gcloud @Arguments "--project=$ProjectId"
    if ($LASTEXITCODE -ne 0) { throw 'Google Cloud command failed. Check the message above.' }
}
function Test-Cloud([string[]]$Arguments) {
    $ErrorActionPreference = 'Continue'
    & gcloud @Arguments "--project=$ProjectId" 2>$null | Out-Null
    return $LASTEXITCODE -eq 0
}
Invoke-Cloud @('services', 'enable', 'run.googleapis.com', 'cloudbuild.googleapis.com', 'artifactregistry.googleapis.com', 'secretmanager.googleapis.com', 'storage.googleapis.com', 'compute.googleapis.com', 'iam.googleapis.com')

$runtimeAccount = "lexipath-runtime@$ProjectId.iam.gserviceaccount.com"
$builderAccount = "lexipath-builder@$ProjectId.iam.gserviceaccount.com"
foreach ($account in @('lexipath-runtime', 'lexipath-builder')) {
    if (-not (Test-Cloud @('iam', 'service-accounts', 'describe', "$account@$ProjectId.iam.gserviceaccount.com"))) {
        Invoke-Cloud @('iam', 'service-accounts', 'create', $account, "--display-name=$account")
    }
}
Invoke-Cloud @('projects', 'add-iam-policy-binding', $ProjectId, "--member=serviceAccount:$builderAccount", '--role=roles/run.builder', '--condition=None')

$bucket = "$ProjectId-lexipath-scans"
if (-not (Test-Cloud @('storage', 'buckets', 'describe', "gs://$bucket"))) {
    Invoke-Cloud @('storage', 'buckets', 'create', "gs://$bucket", "--location=$Region", '--uniform-bucket-level-access', '--public-access-prevention')
}
Invoke-Cloud @('storage', 'buckets', 'add-iam-policy-binding', "gs://$bucket", "--member=serviceAccount:$runtimeAccount", '--role=roles/storage.objectUser')

foreach ($secret in @('lexipath-mongodb-uri', 'lexipath-gemini-api-key', 'lexipath-jwt-secret', 'lexipath-admin-password')) {
    if (-not (Test-Cloud @('secrets', 'describe', $secret))) {
        Invoke-Cloud @('secrets', 'create', $secret, '--replication-policy=automatic')
    }
    Invoke-Cloud @('secrets', 'add-iam-policy-binding', $secret, "--member=serviceAccount:$runtimeAccount", '--role=roles/secretmanager.secretAccessor', '--condition=None')
}

# A dedicated outbound address lets Atlas allow this app without opening to all IPs.
if (-not (Test-Cloud @('compute', 'networks', 'describe', 'lexipath-network'))) {
    Invoke-Cloud @('compute', 'networks', 'create', 'lexipath-network', '--subnet-mode=custom')
}
if (-not (Test-Cloud @('compute', 'networks', 'subnets', 'describe', 'lexipath-subnet', "--region=$Region"))) {
    Invoke-Cloud @('compute', 'networks', 'subnets', 'create', 'lexipath-subnet', '--network=lexipath-network', '--range=10.77.0.0/26', "--region=$Region")
}
if (-not (Test-Cloud @('compute', 'routers', 'describe', 'lexipath-router', "--region=$Region"))) {
    Invoke-Cloud @('compute', 'routers', 'create', 'lexipath-router', '--network=lexipath-network', "--region=$Region")
}
if (-not (Test-Cloud @('compute', 'addresses', 'describe', 'lexipath-egress', "--region=$Region"))) {
    Invoke-Cloud @('compute', 'addresses', 'create', 'lexipath-egress', "--region=$Region")
}
if (-not (Test-Cloud @('compute', 'routers', 'nats', 'describe', 'lexipath-nat', '--router=lexipath-router', "--region=$Region"))) {
    Invoke-Cloud @('compute', 'routers', 'nats', 'create', 'lexipath-nat', '--router=lexipath-router', "--region=$Region", '--nat-custom-subnet-ip-ranges=lexipath-subnet', '--nat-external-ip-pool=lexipath-egress')
}
$outboundIp = & gcloud compute addresses describe lexipath-egress "--region=$Region" "--project=$ProjectId" '--format=value(address)'
if ($LASTEXITCODE -ne 0) { throw 'Could not read the outbound address.' }
Write-Host "Add $outboundIp/32 to MongoDB Atlas Network Access."
Write-Host 'In Secret Manager, add version 1 of the four secrets using the Console.'
Write-Host 'Then run scripts/deploy-gcp.ps1 with the same ProjectId and Region.'
Write-Host 'Cloud Run, NAT, storage, image builds, and the database can incur charges. This script creates resources only when you run it.'
