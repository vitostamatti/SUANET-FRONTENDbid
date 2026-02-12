#!/bin/bash

# SUANET Dashboard - Continuous Monitoring
# Run this script to get real-time monitoring updates

NAMESPACE="suanet-dev"
DEPLOYMENT="suanet-frontend-deployment"
REFRESH_INTERVAL=30

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

clear_screen() {
    clear
    echo -e "${BLUE}=========================================="
    echo -e "🚀 SUANET Frontend Live Dashboard"
    echo -e "Updated: $(date '+%Y-%m-%d %H:%M:%S')"
    echo -e "Refresh: ${REFRESH_INTERVAL}s | Press Ctrl+C to exit"
    echo -e "==========================================${NC}"
}

show_quick_status() {
    echo -e "\n${BLUE}📊 QUICK STATUS${NC}"
    
    # Get pod info
    POD_INFO=$(kubectl get pods -n "$NAMESPACE" -l app=suanet-frontend --no-headers 2>/dev/null)
    if [[ $? -eq 0 && -n "$POD_INFO" ]]; then
        POD_NAME=$(echo "$POD_INFO" | awk '{print $1}')
        STATUS=$(echo "$POD_INFO" | awk '{print $3}')
        RESTARTS=$(echo "$POD_INFO" | awk '{print $4}')
        AGE=$(echo "$POD_INFO" | awk '{print $5}')
        
        if [[ "$STATUS" == "Running" ]]; then
            echo -e "Pod: ${GREEN}$POD_NAME${NC} | Status: ${GREEN}$STATUS${NC} | Restarts: $RESTARTS | Age: $AGE"
        else
            echo -e "Pod: ${RED}$POD_NAME${NC} | Status: ${RED}$STATUS${NC} | Restarts: $RESTARTS | Age: $AGE"
        fi
    else
        echo -e "${RED}❌ Unable to fetch pod information${NC}"
    fi
    
    # Get deployment status
    DEPLOYMENT_STATUS=$(kubectl get deployment "$DEPLOYMENT" -n "$NAMESPACE" --no-headers 2>/dev/null)
    if [[ $? -eq 0 ]]; then
        echo -e "Deployment: ${GREEN}$(echo $DEPLOYMENT_STATUS | awk '{print $2}')${NC} ready replicas"
    fi
}

show_resource_usage() {
    echo -e "\n${BLUE}💾 RESOURCE USAGE${NC}"
    
    POD_NAME=$(kubectl get pods -n "$NAMESPACE" -l app=suanet-frontend -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
    if [[ -n "$POD_NAME" ]]; then
        # Try to get metrics
        METRICS=$(kubectl top pod "$POD_NAME" -n "$NAMESPACE" --no-headers 2>/dev/null)
        if [[ $? -eq 0 ]]; then
            CPU=$(echo "$METRICS" | awk '{print $2}')
            MEMORY=$(echo "$METRICS" | awk '{print $3}' | sed 's/Mi//')
            
            # Calculate memory percentage (limit is 512Mi)
            if [[ "$MEMORY" =~ ^[0-9]+$ ]]; then
                MEMORY_PERCENT=$((MEMORY * 100 / 512))
                if [[ $MEMORY_PERCENT -gt 85 ]]; then
                    echo -e "Memory: ${RED}${MEMORY}Mi/512Mi (${MEMORY_PERCENT}%)${NC} ⚠️"
                elif [[ $MEMORY_PERCENT -gt 70 ]]; then
                    echo -e "Memory: ${YELLOW}${MEMORY}Mi/512Mi (${MEMORY_PERCENT}%)${NC}"
                else
                    echo -e "Memory: ${GREEN}${MEMORY}Mi/512Mi (${MEMORY_PERCENT}%)${NC}"
                fi
            else
                echo -e "Memory: ${MEMORY}/512Mi"
            fi
            echo -e "CPU: $CPU/500m"
        else
            echo -e "${YELLOW}⚠️ Metrics not available (install metrics-server)${NC}"
        fi
    fi
}

show_recent_events() {
    echo -e "\n${BLUE}📋 RECENT EVENTS (last 5)${NC}"
    kubectl get events -n "$NAMESPACE" --sort-by='.lastTimestamp' --field-selector involvedObject.kind=Pod 2>/dev/null | \
    grep suanet-frontend | tail -5 | while read -r line; do
        if echo "$line" | grep -q "Warning\|Error"; then
            echo -e "${RED}$line${NC}"
        else
            echo -e "${GREEN}$line${NC}"
        fi
    done
}

show_log_tail() {
    echo -e "\n${BLUE}📝 LIVE LOGS (last 10 lines)${NC}"
    POD_NAME=$(kubectl get pods -n "$NAMESPACE" -l app=suanet-frontend -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
    if [[ -n "$POD_NAME" ]]; then
        kubectl logs "$POD_NAME" -n "$NAMESPACE" --tail=10 2>/dev/null | while read -r line; do
            if echo "$line" | grep -qi "error\|fail\|exception"; then
                echo -e "${RED}$line${NC}"
            elif echo "$line" | grep -qi "warn"; then
                echo -e "${YELLOW}$line${NC}"
            elif echo "$line" | grep -qi "ready\|success\|start"; then
                echo -e "${GREEN}$line${NC}"
            else
                echo -e "$line"
            fi
        done
    fi
}

show_alerts() {
    echo -e "\n${BLUE}🚨 ALERT CHECKS${NC}"
    
    POD_NAME=$(kubectl get pods -n "$NAMESPACE" -l app=suanet-frontend -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
    if [[ -n "$POD_NAME" ]]; then
        # Check restart count
        RESTARTS=$(kubectl get pod "$POD_NAME" -n "$NAMESPACE" -o jsonpath='{.status.containerStatuses[0].restartCount}' 2>/dev/null)
        if [[ "$RESTARTS" -gt 0 ]]; then
            echo -e "${YELLOW}⚠️ Pod has restarted $RESTARTS times${NC}"
        else
            echo -e "${GREEN}✅ No restarts detected${NC}"
        fi
        
        # Check memory usage
        METRICS=$(kubectl top pod "$POD_NAME" -n "$NAMESPACE" --no-headers 2>/dev/null)
        if [[ $? -eq 0 ]]; then
            MEMORY=$(echo "$METRICS" | awk '{print $3}' | sed 's/Mi//')
            if [[ "$MEMORY" =~ ^[0-9]+$ ]]; then
                MEMORY_PERCENT=$((MEMORY * 100 / 512))
                if [[ $MEMORY_PERCENT -gt 90 ]]; then
                    echo -e "${RED}🚨 CRITICAL: Memory usage above 90% - OOMKill risk!${NC}"
                elif [[ $MEMORY_PERCENT -gt 80 ]]; then
                    echo -e "${YELLOW}⚠️ WARNING: Memory usage above 80%${NC}"
                else
                    echo -e "${GREEN}✅ Memory usage normal${NC}"
                fi
            fi
        fi
        
        # Check for recent OOMKilled events
        OOMKILLED=$(kubectl get events -n "$NAMESPACE" --field-selector reason=Killing 2>/dev/null | grep -i "oomkilled" | wc -l)
        if [[ $OOMKILLED -gt 0 ]]; then
            echo -e "${RED}🚨 OOMKilled events detected in recent history${NC}"
        fi
    fi
}

# Main dashboard loop
main() {
    while true; do
        clear_screen
        show_quick_status
        show_resource_usage
        show_recent_events
        show_log_tail
        show_alerts
        
        echo -e "\n${BLUE}Next refresh in ${REFRESH_INTERVAL} seconds...${NC}"
        sleep "$REFRESH_INTERVAL"
    done
}

# Handle command line arguments
case "${1:-}" in
    "once"|"-o"|"--once")
        clear_screen
        show_quick_status
        show_resource_usage
        show_recent_events
        show_log_tail
        show_alerts
        ;;
    "fast"|"-f"|"--fast")
        REFRESH_INTERVAL=10
        main
        ;;
    "slow"|"-s"|"--slow")
        REFRESH_INTERVAL=60
        main
        ;;
    "help"|"-h"|"--help")
        echo "SUANET Dashboard Usage:"
        echo "  $0           # Start live dashboard (30s refresh)"
        echo "  $0 once      # Show status once and exit"
        echo "  $0 fast      # Fast refresh (10s)"
        echo "  $0 slow      # Slow refresh (60s)"
        echo "  $0 help      # Show this help"
        ;;
    *)
        main
        ;;
esac
