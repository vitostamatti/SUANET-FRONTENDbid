#!/bin/bash
# Wrapper script for chrome-devtools-mcp to connect to existing Chrome instance
exec npx -y chrome-devtools-mcp --browserUrl http://127.0.0.1:9222 "$@"
