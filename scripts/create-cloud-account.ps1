param(
    [Parameter(Mandatory = $true)][string]$ProjectId,
    [Parameter(Mandatory = $true)][ValidatePattern('^[A-Za-z0-9@._-]+$')][string]$Username,
    [Parameter(Mandatory = $true)][ValidatePattern('^[A-Za-z0-9._+%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')][string]$Email,
    [string]$Region = 'us-central1',
    [string]$Service = 'lexipath',
    [ValidatePattern('^[1-9][0-9]*$')][string]$SecretVersion = '1'
)
$ErrorActionPreference = 'Stop'
$image = & gcloud run services describe $Service "--project=$ProjectId" "--region=$Region" '--format=value(spec.template.spec.containers[0].image)'
if ($LASTEXITCODE -ne 0 -or -not $image) { throw 'Deploy the Cloud Run service first.' }
$arguments = @(
    'run', 'jobs', 'deploy', "$Service-create-account",
    "--project=$ProjectId", "--region=$Region", "--image=$image",
    "--service-account=lexipath-runtime@$ProjectId.iam.gserviceaccount.com",
    '--network=lexipath-network', '--subnet=lexipath-subnet', '--vpc-egress=all-traffic',
    '--command=node', '--args=scripts/bootstrapAccount.js',
    "--set-env-vars=ADMIN_USERNAME=$Username,ADMIN_EMAIL=$Email",
    "--set-secrets=MONGODB_URI=lexipath-mongodb-uri:$SecretVersion,ADMIN_PASSWORD=lexipath-admin-password:$SecretVersion",
    '--tasks=1', '--max-retries=0', '--task-timeout=120s', '--execute-now', '--wait'
)
& gcloud @arguments
if ($LASTEXITCODE -ne 0) { throw 'Cloud account creation failed. Check the Cloud Run job logs.' }
Write-Host 'Use your chosen username and the password saved in Secret Manager to sign in.'
