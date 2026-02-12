#!/bin/bash

# SUANET Frontend Monitoring Script
# This script provides comprehensive monitoring for the suanet-frontend-deployment

NAMESPACE="suanet-dev"
DEPLOYMENT="suanet-frontend-deployment"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

echo "=========================================="
echo "SUANET Frontend Monitoring Report"
echo "Generated: $DATE"
echo "=========================================="

# Function to check if kubectl is available
check_kubectl() {
    if ! command -v kubectl &> /dev/null; then
        echo "❌ kubectl not found. Please install kubectl first."
        exit 1
    fi
}

# Function to check deployment status
check_deployment() {
    echo -e "\n🔍 DEPLOYMENT STATUS:"
    echo "----------------------------------------"
    
    # Get deployment status
    kubectl get deployment $DEPLOYMENT -n $NAMESPACE -o wide
    
    # Get replica status
    DESIRED=$(kubectl get deployment $DEPLOYMENT -n $NAMESPACE -o jsonpath='{.spec.replicas}')
    READY=$(kubectl get deployment $DEPLOYMENT -n $NAMESPACE -o jsonpath='{.status.readyReplicas}')
    AVAILABLE=$(kubectl get deployment $DEPLOYMENT -n $NAMESPACE -o jsonpath='{.status.availableReplicas}')
    
    echo -e "\nReplica Status:"
    echo "  Desired: $DESIRED"
    echo "  Ready: ${READY:-0}"
    echo "  Available: ${AVAILABLE:-0}"
    
    if [[ "$READY" == "$DESIRED" ]]; then
        echo "  ✅ All replicas are ready"
    else
        echo "  ⚠️  Replica mismatch detected"
    fi
}

# Function to check pod status and restarts
check_pods() {
    echo -e "\n🔍 POD STATUS:"
    echo "----------------------------------------"
    
    # Get pod information
    kubectl get pods -n $NAMESPACE -l app=suanet-frontend -o wide
    
    echo -e "\nPod Details:"
    kubectl get pods -n $NAMESPACE -l app=suanet-frontend -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.phase}{"\t"}{.status.containerStatuses[0].restartCount}{"\t"}{.status.containerStatuses[0].state}{"\n"}{end}' | while read -r pod phase restarts state; do
        echo "  Pod: $pod"
        echo "    Phase: $phase"
        echo "    Restarts: $restarts"
        echo "    State: $state"
        
        # Check for recent restarts
        if [[ "$restarts" -gt 0 ]]; then
            echo "    ⚠️  Pod has restarted $restarts times"
            
            # Get restart reason if available
            LAST_STATE=$(kubectl get pod $pod -n $NAMESPACE -o jsonpath='{.status.containerStatuses[0].lastState}')
            if [[ "$LAST_STATE" != "null" && "$LAST_STATE" != "{}" ]]; then
                echo "    Last termination reason: $LAST_STATE"
            fi
        fi
        echo
    done
}

# Function to check resource usage
check_resources() {
    echo -e "\n🔍 RESOURCE USAGE:"
    echo "----------------------------------------"
    
    # Get resource requests and limits
    echo "Resource Requests and Limits:"
    kubectl get deployment $DEPLOYMENT -n $NAMESPACE -o jsonpath='{.spec.template.spec.containers[0].resources}' | jq '.'
    
    # Get actual resource usage (requires metrics-server)
    echo -e "\nCurrent Resource Usage:"
    if kubectl top pods -n $NAMESPACE -l app=suanet-frontend &>/dev/null; then
        kubectl top pods -n $NAMESPACE -l app=suanet-frontend
        
        # Calculate memory usage percentage
        POD_NAME=$(kubectl get pods -n $NAMESPACE -l app=suanet-frontend -o jsonpath='{.items[0].metadata.name}')
        if [[ -n "$POD_NAME" ]]; then
            MEMORY_USAGE=$(kubectl top pod "$POD_NAME" -n $NAMESPACE --no-headers | awk '{print $3}' | sed 's/Mi//')
            MEMORY_LIMIT=512  # From deployment.yaml
            
            if [[ -n "$MEMORY_USAGE" && "$MEMORY_USAGE" =~ ^[0-9]+$ ]]; then
                MEMORY_PERCENT=$((MEMORY_USAGE * 100 / MEMORY_LIMIT))
                echo "  Memory Usage: ${MEMORY_USAGE}Mi / ${MEMORY_LIMIT}Mi (${MEMORY_PERCENT}%)"
                
                if [[ $MEMORY_PERCENT -gt 85 ]]; then
                    echo "  ⚠️  High memory usage detected!"
                elif [[ $MEMORY_PERCENT -gt 95 ]]; then
                    echo "  🚨 Critical memory usage - OOMKill risk!"
                fi
            fi
        fi
    else
        echo "  ⚠️  Metrics server not available - install metrics-server for resource usage data"
    fi
}

# Function to check recent events
check_events() {
    echo -e "\n🔍 RECENT EVENTS:"
    echo "----------------------------------------"
    
    # Get recent events for the deployment
    kubectl get events -n $NAMESPACE --field-selector involvedObject.name=$DEPLOYMENT --sort-by='.lastTimestamp' | tail -10
    
    echo -e "\nPod Events (last 10):"
    kubectl get events -n $NAMESPACE --field-selector involvedObject.kind=Pod --sort-by='.lastTimestamp' | grep suanet-frontend | tail -10
}

# Function to check health endpoint
check_health() {
    echo -e "\n🔍 HEALTH CHECK:"
    echo "----------------------------------------"
    
    # Get service information
    SERVICE_NAME="suanet-frontend-monitoring-service"
    
    if kubectl get service $SERVICE_NAME -n $NAMESPACE &>/dev/null; then
        echo "Service found: $SERVICE_NAME"
        
        # Port forward and test health endpoint
        POD_NAME=$(kubectl get pods -n $NAMESPACE -l app=suanet-frontend -o jsonpath='{.items[0].metadata.name}')
        if [[ -n "$POD_NAME" ]]; then
            echo "Testing health endpoint on pod: $POD_NAME"
            
            # Test health endpoint using port-forward in background
            kubectl port-forward pod/$POD_NAME -n $NAMESPACE 8080:3000 &
            PF_PID=$!
            sleep 2
            
            if curl -s http://localhost:8080/api/health | jq '.' &>/dev/null; then
                echo "✅ Health endpoint responding correctly"
                curl -s http://localhost:8080/api/health | jq '.memory, .status, .uptime'
            else
                echo "❌ Health endpoint not responding"
            fi
            
            # Clean up port-forward
            kill $PF_PID 2>/dev/null
        fi
    else
        echo "⚠️  Monitoring service not found"
    fi
}

# Function to check logs for errors
check_logs() {
    echo -e "\n🔍 RECENT LOGS (last 50 lines):"
    echo "----------------------------------------"
    
    POD_NAME=$(kubectl get pods -n $NAMESPACE -l app=suanet-frontend -o jsonpath='{.items[0].metadata.name}')
    if [[ -n "$POD_NAME" ]]; then
        echo "Pod: $POD_NAME"
        kubectl logs $POD_NAME -n $NAMESPACE --tail=50
    else
        echo "❌ No pods found"
    fi
}

# Function to provide recommendations
provide_recommendations() {
    echo -e "\n💡 RECOMMENDATIONS:"
    echo "----------------------------------------"
    
    # Check for OOMKilled in recent events
    OOMKILLED=$(kubectl get events -n $NAMESPACE --field-selector reason=Killing | grep -i "oomkilled\|memory" | wc -l)
    if [[ $OOMKILLED -gt 0 ]]; then
        echo "🚨 OOMKilled events detected in recent history!"
        echo "   - Consider increasing memory limits (currently 512Mi)"
        echo "   - Monitor application memory usage patterns"
        echo "   - Review application for memory leaks"
    fi
    
    # Check restart count
    RESTARTS=$(kubectl get pods -n $NAMESPACE -l app=suanet-frontend -o jsonpath='{.items[0].status.containerStatuses[0].restartCount}')
    if [[ "$RESTARTS" -gt 3 ]]; then
        echo "⚠️  High restart count detected ($RESTARTS restarts)"
        echo "   - Review application logs for errors"
        echo "   - Check resource limits and requests"
        echo "   - Verify health check endpoints"
    fi
    
    echo -e "\n📋 MONITORING CHECKLIST:"
    echo "   □ Deploy monitoring.yaml for comprehensive monitoring"
    echo "   □ Deploy alerts.yaml for PrometheusRule alerting"
    echo "   □ Ensure metrics-server is installed for resource monitoring"
    echo "   □ Configure log aggregation (ELK/Fluentd)"
    echo "   □ Set up dashboard in Grafana"
    echo "   □ Test alert notifications"
}

# Main execution
main() {
    check_kubectl
    check_deployment
    check_pods
    check_resources
    check_events
    check_health
    check_logs
    provide_recommendations
    
    echo -e "\n=========================================="
    echo "Monitoring report completed: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "=========================================="
}

# Run with specific checks if arguments provided
if [[ $# -gt 0 ]]; then
    case $1 in
        "deployment"|"deploy")
            check_kubectl && check_deployment
            ;;
        "pods"|"pod")
            check_kubectl && check_pods
            ;;
        "resources"|"res")
            check_kubectl && check_resources
            ;;
        "events")
            check_kubectl && check_events
            ;;
        "health")
            check_kubectl && check_health
            ;;
        "logs")
            check_kubectl && check_logs
            ;;
        "recommendations"|"rec")
            provide_recommendations
            ;;
        *)
            echo "Usage: $0 [deployment|pods|resources|events|health|logs|recommendations]"
            echo "Run without arguments for full report"
            exit 1
            ;;
    esac
else
    main
fi
