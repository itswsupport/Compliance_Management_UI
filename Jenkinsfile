// Compliance Portal UI — build, lint, scan and deploy the nginx container.
//
// The agent needs Docker and nothing else: npm never runs on the agent itself,
// it runs inside the builder image, so Node does not have to be installed or
// kept in step with the project.

pipeline {
  agent any

  triggers {
    githubPush()
  }

  options {
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '15'))
    timeout(time: 45, unit: 'MINUTES')
  }

  parameters {
    string(
      name: 'VITE_API_BASE_URL',
      defaultValue: 'https://replportal.co.in:8443/compliancePortal/',
      description: 'Spring backend the browser calls. Baked in at BUILD time by Vite — changing it requires a rebuild, not a restart. Never "localhost" here for a deployed build: that resolves in the visitor\'s browser, not on the server.'
    )
    string(
      name: 'HOST_PORT',
      defaultValue: '3030',
      description: 'Port on the Docker host to publish the app on.'
    )
    booleanParam(
      name: 'DEPLOY',
      defaultValue: true,
      description: 'Untick to build, lint and scan only, without replacing the running container.'
    )
    booleanParam(
      name: 'FAIL_ON_VULNERABILITIES',
      defaultValue: false,
      description: 'Tick to fail the build when Trivy finds CRITICAL/HIGH issues instead of only reporting them.'
    )
    booleanParam(
      name: 'DEV_LOGIN',
      defaultValue: true,
      description: 'Builds with NODE_ENV=development, which makes import.meta.env.DEV true so LoginCheck shows its manual login form instead of redirecting to the RUCHA portal — the deployed site then behaves like a local build. UNTICK to get the normal portal handoff. Note that while the DEV component is active in LoginCheck.jsx, this build also reads emp_code from the URL and authenticates it with a hardcoded password. The API URL is unaffected — it still comes from .env.production.'
    )
  }

  environment {
    RECIPIENTS = 'itswsupport@ruchagroup.com'
    IMAGE      = 'compliance-ui'
    CONTAINER  = 'ui-compliance'
    TAG        = "${env.BUILD_NUMBER}"

    // Trivy configuration
    TRIVY_SEVERITY  = 'CRITICAL,HIGH'
  }

  stages {
    stage('Checkout Code') {
      steps {
        git(
          url: 'https://github.com/itswsupport/Compliance_Management_UI.git',
          branch: 'main',
          credentialsId: 'ui-payroll'
        )
        script {
          env.GIT_SHA = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
          env.TRIVY_EXIT_CODE = params.FAIL_ON_VULNERABILITIES ? '1' : '0'

          // Vite reads import.meta.env.DEV from NODE_ENV, so this — not the
          // Vite --mode — is what decides whether the manual login form is
          // compiled in. BUILD_MODE is left at its production default either
          // way, so the API URL always comes from .env.production.
          //
          // Compared against false rather than used directly: on the first run
          // after this parameter is added, Jenkins has not registered it yet
          // and params.DEV_LOGIN is null. A plain truthiness test would read
          // that as "off" and quietly build the wrong variant, which is exactly
          // the failure this is meant to avoid — so only an explicit untick
          // selects production.
          env.BUILD_NODE_ENV = (params.DEV_LOGIN == false) ? 'production' : 'development'
          echo "Building with NODE_ENV=${env.BUILD_NODE_ENV} (DEV_LOGIN=${params.DEV_LOGIN})"
        }
        echo "Building ${env.IMAGE}:${env.TAG} from ${env.GIT_SHA}"
      }
    }

    stage('Build') {
      steps {
        // --target builder stops at the Vite compile stage, so the same layers
        // are reused by the runtime build below rather than compiled twice.
        // No --no-cache: the npm ci layer is keyed on package-lock.json, so a
        // source-only change reuses the installed node_modules.
        sh """
          docker build \
            --target builder \
            --build-arg NODE_ENV='${env.BUILD_NODE_ENV}' \
            -t ${IMAGE}:builder-${TAG} \
            .
        """
      }
    }

    stage('Lint') {
      steps {
        // Runs in the image just built, against the same node_modules the
        // compile used. oxlint exits 0 on warnings, non-zero on errors.
        sh "docker run --rm ${IMAGE}:builder-${TAG} npm run lint"
      }
    }

    stage('OWASP Dependency Check') {
      steps {
        dependencyCheck additionalArguments: '''
          --scan .
          --format HTML
          --format XML
          --out .
          --prettyPrint
        ''', odcInstallation: 'Dependency-Check'

        dependencyCheckPublisher pattern: 'dependency-check-report.xml'
      }
    }

    stage('Package') {
      steps {
        sh """
          docker build \
            --build-arg NODE_ENV='${env.BUILD_NODE_ENV}' \
            -t ${IMAGE}:${TAG} \
            -t ${IMAGE}:latest \
            .
        """
      }
    }

    stage('Verify Bundle') {
      steps {
        // Vite inlines VITE_API_BASE_URL into the JS, so a wrong value is
        // invisible until someone opens the site and every request 404s.
        // Assert the value actually reached the bundle.
        //
        // The URL now comes from .env.production, which Vite reads itself — the
        // Dockerfile no longer sets it as an ENV, because a process env var
        // would take priority over that file. So this parameter no longer
        // *sets* the URL; it asserts which URL the build was expected to carry,
        // and fails here if .env.production says something else (a leftover
        // localhost value, most likely).
        sh """
          docker run --rm --entrypoint sh ${IMAGE}:${TAG} -c \
            "grep -rqF '${params.VITE_API_BASE_URL}' /app/dist/assets/" \
            || { echo "API base URL '${params.VITE_API_BASE_URL}' is not present in the built bundle"; exit 1; }
          echo "bundle points at ${params.VITE_API_BASE_URL}"
        """
      }
    }

    stage('Trivy FS Scan') {
      steps {
        sh '''
          trivy fs --format table \
            --severity ${TRIVY_SEVERITY} \
            --exit-code ${TRIVY_EXIT_CODE} \
            --scanners vuln,secret,misconfig \
            . > trivy-fs-report.txt 2>&1 || true

          trivy fs --format json \
            --severity ${TRIVY_SEVERITY} \
            --output trivy-fs-report.json \
            --scanners vuln,secret,misconfig \
            . || true

          echo "=== Trivy FS Scan Results ==="
          cat trivy-fs-report.txt
        '''
      }
    }

    stage('Trivy Image Scan') {
      steps {
        sh '''
          trivy image --format table \
            --severity ${TRIVY_SEVERITY} \
            --exit-code ${TRIVY_EXIT_CODE} \
            --scanners vuln \
            ${IMAGE}:${TAG} > trivy-image-report.txt 2>&1 || true

          trivy image --format json \
            --severity ${TRIVY_SEVERITY} \
            --output trivy-image-report.json \
            --scanners vuln \
            ${IMAGE}:${TAG} || true

          trivy image --format template \
            --template "@/usr/share/trivy/templates/html.tpl" \
            --severity ${TRIVY_SEVERITY} \
            --output trivy-image-report.html \
            ${IMAGE}:${TAG} || true

          echo "=== Trivy Image Scan Results ==="
          cat trivy-image-report.txt
        '''
      }
    }

    stage('Trivy Scan Quality Gate') {
      steps {
        script {
          def criticalVulns = sh(
            script: '''
              COUNT=$(trivy image --format json \
                --severity CRITICAL \
                --scanners vuln \
                ${IMAGE}:${TAG} 2>/dev/null | \
                grep -c '"Severity": "CRITICAL"' || true)
              echo "${COUNT:-0}"
            ''',
            returnStdout: true
          ).trim()

          def vulnCount = criticalVulns.isInteger() ? criticalVulns.toInteger() : 0

          if (vulnCount > 0) {
            echo "WARNING: Found ${vulnCount} CRITICAL vulnerabilities!"
            if (params.FAIL_ON_VULNERABILITIES) {
              error "Failing build: ${vulnCount} CRITICAL vulnerabilities (FAIL_ON_VULNERABILITIES is ticked)"
            }
          } else {
            echo "No CRITICAL vulnerabilities found."
          }
        }
      }
    }

    stage('Deploy') {
      when { expression { return params.DEPLOY } }
      steps {
        sh """
          set -e

          # Preflight. Nothing is torn down until the port is known to be ours
          # to take: a clash used to surface only after `docker rm -f` had
          # already destroyed the running container, so a port held by
          # something else took the site down instead of failing the build.
          OTHERS=\$(docker ps --filter "publish=${params.HOST_PORT}" --format '{{.Names}}' | grep -vx '${CONTAINER}' || true)
          if [ -n "\$OTHERS" ]; then
            echo "port ${params.HOST_PORT} is already published by container(s): \$OTHERS"
            echo "the running ${CONTAINER} has been left untouched — free that port or pick another HOST_PORT"
            exit 1
          fi

          # With our own container not running, any listener on the port
          # belongs to something outside Docker. If ss is missing the grep
          # finds nothing and this degrades to the previous behaviour.
          if [ -z "\$(docker ps -q -f name='^${CONTAINER}\$')" ]; then
            if ss -ltn 2>/dev/null | grep -q ':${params.HOST_PORT} '; then
              echo "port ${params.HOST_PORT} is held by a process on the host, not by Docker:"
              ss -ltnp 2>/dev/null | grep ':${params.HOST_PORT} ' || true
              exit 1
            fi
          fi

          docker rm -f ${CONTAINER} || true

          # docker-proxy can keep the binding for a moment after the container
          # goes. Wait for it to let go rather than racing it.
          for i in \$(seq 1 15); do
            ss -ltn 2>/dev/null | grep -q ':${params.HOST_PORT} ' || break
            sleep 1
          done

          # HOST_PORT:3000 — the right-hand side is the port INSIDE the
          # container, fixed at 3000 by the image: it runs as an unprivileged
          # user, which cannot bind anything below 1024. Only the left-hand side
          # is yours to choose.
          docker run -d \
            --name ${CONTAINER} \
            --restart unless-stopped \
            -p ${params.HOST_PORT}:3000 \
            ${IMAGE}:${TAG}
        """
      }
    }

    stage('Smoke Test') {
      when { expression { return params.DEPLOY } }
      steps {
        // Polls rather than sleeping a fixed time: the container is ready when
        // it answers, not when a timer says so.
        sh """
          for i in \$(seq 1 30); do
            if curl -fsS -o /dev/null http://localhost:${params.HOST_PORT}/; then
              echo "up after \${i}s"
              exit 0
            fi
            sleep 1
          done
          echo "app did not answer on / within 30s"
          docker logs --tail 50 ${CONTAINER}
          exit 1
        """
      }
    }

    stage('Verify SPA Routing') {
      when { expression { return params.DEPLOY } }
      steps {
        // BrowserRouter has no basename, so every unmatched path is a
        // client-side route. Without nginx's try_files fallback, refreshing on
        // any route other than / returns 404 — assert it does not.
        sh """
          CODE=\$(curl -s -o /dev/null -w '%{http_code}' http://localhost:${params.HOST_PORT}/comp-admin/pending)
          if [ "\$CODE" != "200" ]; then
            echo "SPA fallback broken: /comp-admin/pending returned \$CODE, expected 200"
            exit 1
          fi
          echo "SPA fallback OK"
        """
      }
    }

    stage('Cleanup Old Images') {
      steps {
        sh '''
          # Keep only last 3 runtime builds
          docker images ${IMAGE} --format "{{.Tag}}" | grep -E '^[0-9]+$' | sort -rn | tail -n +4 | xargs -r -I {} docker rmi ${IMAGE}:{}

          # Remove dangling images
          docker image prune -f
        '''
      }
    }
  }

  post {
    success {
      mail to: "${RECIPIENTS}",
           subject: "Jenkins Build SUCCESS: ${env.JOB_NAME} [#${env.BUILD_NUMBER}]",
           body: """
The build was successful!

Job: ${env.JOB_NAME}
Build: ${env.BUILD_URL}
Branch: main
Commit: ${env.GIT_SHA}
API base URL: ${params.VITE_API_BASE_URL}
Status: ${params.DEPLOY ? "Deployed and running on port ${params.HOST_PORT}" : 'Built only (DEPLOY unticked)'}

Security Scans:
- OWASP Dependency Check: Completed
- Trivy Vulnerability Scan: Completed

View Trivy Report: ${env.BUILD_URL}Trivy_Vulnerability_Report/
"""
    }
    failure {
      mail to: "${RECIPIENTS}",
           subject: "Jenkins Build FAILED: ${env.JOB_NAME} [#${env.BUILD_NUMBER}]",
           body: """
The build has failed.

Job: ${env.JOB_NAME}
Build: ${env.BUILD_URL}
Branch: main
Commit: ${env.GIT_SHA}
Status: Failed

Security Scans may have identified issues. Check:
- Trivy Report: ${env.BUILD_URL}Trivy_Vulnerability_Report/
- OWASP Report: ${env.BUILD_URL}artifact/dependency-check-report.html

Please check the console output: ${env.BUILD_URL}console
"""
    }
    always {
      // Archive container logs
      sh 'docker logs ${CONTAINER} > docker-logs.txt 2>&1 || true'
      archiveArtifacts artifacts: 'docker-logs.txt', allowEmptyArchive: true

      // Archive Trivy reports
      archiveArtifacts artifacts: 'trivy-*.txt, trivy-*.json, trivy-*.html', allowEmptyArchive: true

      // Publish HTML report (requires HTML Publisher plugin)
      publishHTML(target: [
        allowMissing: true,
        alwaysLinkToLastBuild: true,
        keepAll: true,
        reportDir: '.',
        reportFiles: 'trivy-image-report.html',
        reportName: 'Trivy Vulnerability Report'
      ])

      // Intermediate builder images accumulate fast — one per build.
      sh "docker image rm -f ${IMAGE}:builder-${TAG} || true"
      sh 'docker image prune -f --filter "until=168h" || true'
    }
  }
}
