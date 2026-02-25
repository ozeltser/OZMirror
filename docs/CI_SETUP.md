# CI/CD Setup Guide

This guide explains how to wire up the GitHub Actions CI/CD pipeline so that every push to `main` runs the test suite and automatically deploys fresh code to your Raspberry Pi.

---

## How It Works

```
Push to main / PR
       │
       ▼
GitHub Actions (ubuntu-latest, free)
  ├── test-config  — pytest (Config Service)
  ├── test-ui      — vitest (React UI)
  └── test-modules — vitest × 6 modules (parallel)
       │ all pass
       ▼  (main branch only)
GitHub Actions (self-hosted runner on Pi)
  └── deploy — git pull + make deploy
```

- Tests run on GitHub's hosted machines — no Pi resources are consumed.
- The deploy job only fires on a push to `main` (not PRs) and only if all tests pass.
- `make deploy` does `git pull + docker compose up -d --build`, rebuilding every image from fresh source.

---

## Step 1 — Add the `DEPLOY_PATH` Secret

The deploy job needs to know where on the Pi to find the OZMirror checkout. Set this once.

**Default value:** `/opt/ozmirror`
**Change it if** your repo lives somewhere else (e.g. `~/ozmirror`).

### Via GitHub UI

1. Go to your repository → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Name: `DEPLOY_PATH`
   Value: `/opt/ozmirror`
4. Click **Add secret**

### Via `gh` CLI

```bash
gh secret set DEPLOY_PATH --body "/opt/ozmirror" --repo <owner>/OZMirror
```

Verify it was set:

```bash
gh secret list --repo <owner>/OZMirror
```

---

## Step 2 — Register a Self-Hosted Runner on the Pi

The runner is a small agent that runs on the Pi and polls GitHub for jobs. It connects outbound over HTTPS, so no inbound port forwarding is needed.

### Via GitHub UI

1. Go to your repository → **Settings** → **Actions** → **Runners**
2. Click **New self-hosted runner**
3. Select **Linux** / **ARM64**
4. Follow the commands shown on screen (they include a one-time registration token)
5. When `config.sh` asks for labels, enter: `pi`
6. When asked for runner name, enter: `ozmirror-pi` (or anything you prefer)

### Via `gh` CLI

Generate a registration token on your local machine:

```bash
gh api -X POST repos/<owner>/OZMirror/actions/runners/registration-token --jq .token
```

Then on the Pi, download and configure the runner. Check https://github.com/actions/runner/releases for the latest version number:

```bash
mkdir ~/actions-runner && cd ~/actions-runner

# Set the version once — update this to the latest from the releases page
RUNNER_VERSION=2.x.x

curl -o actions-runner-linux-arm64.tar.gz -L \
  "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-arm64-${RUNNER_VERSION}.tar.gz"

tar xzf ./actions-runner-linux-arm64.tar.gz

# Configure (paste the token from the step above)
./config.sh \
  --url https://github.com/<owner>/OZMirror \
  --token <TOKEN> \
  --labels pi \
  --name ozmirror-pi \
  --unattended
```

---

## Step 3 — Run the Runner as a Systemd Service

This makes the runner start automatically on Pi reboot.

```bash
cd ~/actions-runner
sudo ./svc.sh install
sudo ./svc.sh start
```

Check that it is running:

```bash
sudo ./svc.sh status
```

> **Docker permissions:** The runner's user must be in the `docker` group so `make deploy` (which calls `docker compose`) works without sudo:
>
> ```bash
> sudo usermod -aG docker $(whoami)
> ```
>
> Log out and back in (or reboot) for the group change to take effect.

> **Directory permissions:** The runner user must have write access to the deployment directory (substitute your actual `DEPLOY_PATH` secret value if it differs from the default):
>
> ```bash
> sudo chown -R $(whoami):$(whoami) /opt/ozmirror   # replace with your DEPLOY_PATH value
> ```

---

## Step 4 — Verify the Runner is Online

### Via GitHub UI

Go to your repository → **Settings** → **Actions** → **Runners**
The `ozmirror-pi` runner should show as **Idle**.

### Via `gh` CLI

```bash
gh api repos/<owner>/OZMirror/actions/runners \
  --jq '.runners[] | {name, status, labels: [.labels[].name]}'
```

Expected output:

```json
{
  "name": "ozmirror-pi",
  "status": "online",
  "labels": ["self-hosted", "Linux", "ARM64", "pi"]
}
```

---

## Triggering a Deployment

Deployments happen automatically on every push to `main`. You can also trigger one manually.

### Via GitHub UI

1. Go to your repository → **Actions** tab
2. Click **CI / CD** in the left sidebar
3. Click **Run workflow** → select `main` → **Run workflow**

### Via `gh` CLI

```bash
gh workflow run ci-cd.yml --ref main --repo <owner>/OZMirror
```

---

## Monitoring a Deployment

### Via GitHub UI

Go to the **Actions** tab and click the running workflow to see live logs per job.

### Via `gh` CLI

```bash
# List recent runs
gh run list --workflow ci-cd.yml --repo <owner>/OZMirror

# Watch a live run (prints status until it finishes)
gh run watch <run-id> --repo <owner>/OZMirror

# Print full logs after completion
gh run view <run-id> --log --repo <owner>/OZMirror
```

---

## Removing the Runner

If you need to deregister the runner (e.g. to move it to a different machine):

```bash
cd ~/actions-runner
sudo ./svc.sh stop
sudo ./svc.sh uninstall
./config.sh remove --token <REMOVE_TOKEN>
```

Generate the remove token:

```bash
gh api -X POST repos/<owner>/OZMirror/actions/runners/remove-token --jq .token
```
