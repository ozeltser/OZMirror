# CI/CD Setup — Your To-Do Checklist

Complete these steps once after the pull request is merged. Detailed instructions for each step are in [`docs/CI_SETUP.md`](CI_SETUP.md).

---

## On GitHub (5 minutes)

- [ ] **Add the `DEPLOY_PATH` secret**
  ```bash
  gh secret set DEPLOY_PATH --body "/opt/ozmirror" --repo <owner>/OZMirror
  ```
  *(Change `/opt/ozmirror` if your repo lives somewhere else on the Pi.)*

- [ ] **Verify the secret exists**
  ```bash
  gh secret list --repo <owner>/OZMirror
  ```

---

## On the Raspberry Pi (10–15 minutes)

- [ ] **1. Add your user to the `docker` group** (skip if already done)
  ```bash
  sudo usermod -aG docker $(whoami)
  ```
  Then log out and back in (or reboot) before continuing.

- [ ] **2. Confirm the deployment directory exists and is writable**
  ```bash
  ls /opt/ozmirror          # should show the repo
  touch /opt/ozmirror/.test && rm /opt/ozmirror/.test  # write check
  ```

- [ ] **3. Download and configure the Actions runner**

  Get a registration token (run on your local machine):
  ```bash
  gh api -X POST repos/<owner>/OZMirror/actions/runners/registration-token --jq .token
  ```

  Then on the Pi (replace `2.x.x` with the [latest runner version](https://github.com/actions/runner/releases) and paste the token):
  ```bash
  mkdir ~/actions-runner && cd ~/actions-runner
  curl -o actions-runner-linux-arm64.tar.gz -L \
    https://github.com/actions/runner/releases/download/v2.x.x/actions-runner-linux-arm64-2.x.x.tar.gz
  tar xzf ./actions-runner-linux-arm64.tar.gz
  ./config.sh \
    --url https://github.com/<owner>/OZMirror \
    --token <TOKEN> \
    --labels pi \
    --name ozmirror-pi \
    --unattended
  ```

- [ ] **4. Install the runner as a systemd service** (auto-starts on reboot)
  ```bash
  cd ~/actions-runner
  sudo ./svc.sh install
  sudo ./svc.sh start
  sudo ./svc.sh status   # should show "active (running)"
  ```

---

## Verify Everything Is Wired Up

- [ ] **Runner shows as online on GitHub**
  ```bash
  gh api repos/<owner>/OZMirror/actions/runners \
    --jq '.runners[] | {name, status, labels: [.labels[].name]}'
  ```
  Expected: `"status": "online"`

- [ ] **Trigger a test deployment manually**
  ```bash
  gh workflow run ci-cd.yml --ref main --repo <owner>/OZMirror
  ```

- [ ] **Watch it complete**
  ```bash
  gh run list --workflow ci-cd.yml --repo <owner>/OZMirror
  gh run watch <run-id> --repo <owner>/OZMirror
  ```

---

## Done

Once the deploy job shows green, every future push to `main` will automatically:
1. Run all tests (Config Service, UI, all 6 modules)
2. Deploy fresh code to the Pi via `make deploy`

No further manual steps are needed.
