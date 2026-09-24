# NexusLearn edge gateway

The default Compose profile uses `nginx.dev.conf` for local HTTP at `http://localhost`. It still balances API and Socket.IO traffic across both API nodes.

For TLS deployment, provide trusted certificate files at `nginx/certs/fullchain.pem` and `nginx/certs/privkey.pem`, set `NGINX_CONFIG=./nginx/nginx.conf` in the Compose environment, then recreate the gateway. The production config redirects port 80 to HTTPS and serves the app/API on port 443.

The API upstream uses `least_conn`. Socket.IO's Redis adapter shares room events between nodes. Socket.IO is configured for WebSocket transport so the Engine.IO polling handshake does not require node affinity.
