# CB-CAP agentic workspace configuration

The public dashboard does not require the agentic runtime. Institutional controls appear only when all four public build variables below are valid:

```text
NEXT_PUBLIC_CBCAP_AGENTIC_API_BASE=https://api.cbcap.sozorockfoundation.org
NEXT_PUBLIC_CBCAP_COGNITO_DOMAIN=https://<approved-domain>.auth.<region>.amazoncognito.com
NEXT_PUBLIC_CBCAP_COGNITO_CLIENT_ID=<public-client-id>
NEXT_PUBLIC_CBCAP_COGNITO_REDIRECT_URI=https://cbcap.sozorockfoundation.org/auth/callback
```

The API base is intentionally pinned to the production origin above. Origin drift disables the controls.

The Cognito client must be a public client with authorization-code flow, PKCE, callback `https://cbcap.sozorockfoundation.org/auth/callback`, logout `https://cbcap.sozorockfoundation.org/`, and `openid email profile` scopes. The callback exchanges the code directly with Cognito, removes OAuth parameters from browser history, and returns with client-side routing so the workspace can use the in-memory session. `sessionStorage` contains only short-lived PKCE state and verifier material; the application never writes tokens to `localStorage`, `sessionStorage`, cookies, or URLs. A page reload therefore requires a new sign-in.

The CB-CAP deployment role cannot read outputs from the separately managed agentic CloudFormation stack. Configure the nonsecret repository environment variables `CBCAP_COGNITO_DOMAIN` and `CBCAP_COGNITO_CLIENT_ID`. The deployment workflow validates them and writes the four `NEXT_PUBLIC_CBCAP_*` values into the exact CB-CAP Amplify application while preserving its existing environment.

Activation also requires the agentic production edge to expose the contracted `/api/health` response with institutional and visualization capability flags and CORS for `https://cbcap.sozorockfoundation.org`. Until then, the UI accurately reports the institutional runtime as unavailable and leaves the public dashboard operational.
