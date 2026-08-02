# Repository Context

The Version 1 implementation of this project is located at:

- Linux: `/root/study-abroad`
- macOS: `/Users/safvanhusain/code/inside/study-abroad`

When working on Version 1 or comparing behavior with the previous implementation, use the path matching the current operating system.

## Docker And Browser Verification

- The application runs entirely in Docker. There is no separately deployed module or external runtime to provision; use the repository's Docker Compose stack.
- Build and start the current stack before browser testing: `docker compose -f docker-compose.production.yml up -d --build`.
- The web application is published from container port `3000` on VPS host port `3010`. Use `http://localhost:3010/` on the VPS and `http://200.141.7.99:3010/` from an external machine.
- After making application changes or fixing an issue, verify the result with the Playwright CLI against the Docker-hosted application. Always rebuild the Docker container before running Playwright.
