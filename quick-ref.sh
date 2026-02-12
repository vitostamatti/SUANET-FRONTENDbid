#!/bin/bash
# SUANET Frontend Quick Reference
# Save this as a bookmark for daily operations

echo "🚀 SUANET Frontend Monitoring - Quick Reference"
echo "=============================================="
echo
echo "📊 MONITORING COMMANDS:"
echo "  ./dashboard.sh          # Live dashboard"
echo "  ./dashboard.sh once     # Quick status"
echo "  ./monitor.sh           # Full report"
echo "  ./monitor.sh pods      # Pod status only"
echo
echo "🔍 KUBERNETES COMMANDS:"
echo "  kubectl get pods -n suanet-dev -l app=suanet-frontend"
echo "  kubectl logs -f deployment/suanet-frontend-deployment -n suanet-dev"
echo "  kubectl top pods -n suanet-dev -l app=suanet-frontend"
echo "  kubectl describe deployment suanet-frontend-deployment -n suanet-dev"
echo
echo "🚨 EMERGENCY CHECKS:"
echo "  kubectl get events -n suanet-dev --sort-by='.lastTimestamp' | tail -10"
echo "  kubectl rollout status deployment/suanet-frontend-deployment -n suanet-dev"
echo
echo "💾 CURRENT LIMITS:"
echo "  Memory: 512Mi (4x increase from 128Mi)"
echo "  CPU: 500m"
echo "  Alert at: 85% memory usage (435Mi)"
echo
echo "✅ SYSTEM STATUS:"
kubectl get pods -n suanet-dev -l app=suanet-frontend --no-headers | head -1
echo
echo "🔗 FILES:"
echo "  monitoring-simple.yaml  # Basic monitoring config"
echo "  deployment.yaml        # Updated deployment"
echo "  MONITORING_REPORT.md   # Full documentation"
echo
echo "Run './dashboard.sh' for live monitoring!"
