#!/bin/bash

#############################################################################
# SUANET Production Health Check - Test de 5 Minutos
# 
# Script automatizado para verificar el estado de SUANET en producción
# Ejecuta 5 tests críticos y genera un reporte detallado
#
# Uso: ./suanet-health-check.sh [--verbose] [--json]
#
# Opciones:
#   --verbose    Mostrar output detallado de cada comando
#   --json       Generar output en formato JSON para parsing automatizado
#   --help       Mostrar esta ayuda
#
# Exit codes:
#   0 = Todos los tests pasaron (sistema operativo al 100%)
#   1 = Al menos un test falló (requiere diagnóstico)
#   2 = Error en el script (parámetros inválidos, etc.)
#############################################################################

set -o pipefail

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Configuración
DOMAIN="suanet.movilidadbogota.gov.co"
EXPECTED_CNAME="suanet-hfaqd8ckefasepez.z01.azurefd.net"
EXPECTED_IPS=("13.107.213.41" "13.107.246.41")
EXPECTED_CERT_CN="*.movilidadbogota.gov.co"
TIMEOUT=10

# Flags
VERBOSE=false
JSON_OUTPUT=false
TESTS_PASSED=0
TESTS_FAILED=0
TEST_RESULTS=()

# Timestamp
START_TIME=$(date +%s)
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

#############################################################################
# Funciones auxiliares
#############################################################################

print_header() {
    if [ "$JSON_OUTPUT" = false ]; then
        echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${BLUE}║${NC}  ${BOLD}SUANET Production Health Check - Test de 5 Minutos${NC}     ${BLUE}║${NC}"
        echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
        echo -e "${CYAN}Dominio:${NC} $DOMAIN"
        echo -e "${CYAN}Timestamp:${NC} $TIMESTAMP"
        echo ""
    fi
}

print_test_header() {
    local test_num=$1
    local test_name=$2
    if [ "$JSON_OUTPUT" = false ]; then
        echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${CYAN}TEST $test_num:${NC} $test_name"
        echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    fi
}

print_success() {
    if [ "$JSON_OUTPUT" = false ]; then
        echo -e "${GREEN}✓${NC} $1"
    fi
}

print_error() {
    if [ "$JSON_OUTPUT" = false ]; then
        echo -e "${RED}✗${NC} $1"
    fi
}

print_warning() {
    if [ "$JSON_OUTPUT" = false ]; then
        echo -e "${YELLOW}⚠${NC} $1"
    fi
}

print_info() {
    if [ "$JSON_OUTPUT" = false ] && [ "$VERBOSE" = true ]; then
        echo -e "${CYAN}ℹ${NC} $1"
    fi
}

record_result() {
    local test_name=$1
    local status=$2
    local message=$3
    local details=$4
    
    if [ "$status" = "PASS" ]; then
        ((TESTS_PASSED++))
    else
        ((TESTS_FAILED++))
    fi
    
    if [ "$JSON_OUTPUT" = true ]; then
        TEST_RESULTS+=("{\"test\":\"$test_name\",\"status\":\"$status\",\"message\":\"$message\",\"details\":\"$details\"}")
    fi
}

#############################################################################
# TEST 1: DNS Resolution
#############################################################################
test_dns() {
    print_test_header "1/5" "DNS Resolution"
    
    local test_name="dns_resolution"
    local dns_output
    local status="FAIL"
    local message=""
    local details=""
    
    print_info "Ejecutando: nslookup $DOMAIN 8.8.8.8"
    
    # Ejecutar nslookup
    dns_output=$(nslookup "$DOMAIN" 8.8.8.8 2>&1)
    
    if [ $? -eq 0 ]; then
        # Verificar CNAME
        if echo "$dns_output" | grep -q "$EXPECTED_CNAME"; then
            print_success "CNAME correcto: $EXPECTED_CNAME"
            
            # Verificar que resuelve a IPs esperadas
            local ips_found=0
            for ip in "${EXPECTED_IPS[@]}"; do
                if echo "$dns_output" | grep -q "$ip"; then
                    print_success "IP encontrada: $ip"
                    ((ips_found++))
                fi
            done
            
            if [ $ips_found -gt 0 ]; then
                status="PASS"
                message="DNS resuelve correctamente a Azure Front Door"
                details="CNAME: $EXPECTED_CNAME, IPs: $ips_found/${#EXPECTED_IPS[@]}"
            else
                message="DNS resuelve a CNAME correcto pero IPs inesperadas"
                print_warning "$message"
            fi
        else
            message="CNAME incorrecto o no encontrado"
            print_error "$message"
            print_error "Esperado: $EXPECTED_CNAME"
        fi
    else
        message="DNS no resuelve - dominio no encontrado"
        print_error "$message"
    fi
    
    if [ "$VERBOSE" = true ] && [ "$JSON_OUTPUT" = false ]; then
        echo ""
        echo "Output completo:"
        echo "$dns_output"
    fi
    
    record_result "$test_name" "$status" "$message" "$details"
    echo ""
}

#############################################################################
# TEST 2: HTTPS Connectivity
#############################################################################
test_https() {
    print_test_header "2/5" "HTTPS Connectivity"
    
    local test_name="https_connectivity"
    local http_output
    local status="FAIL"
    local message=""
    local details=""
    
    print_info "Ejecutando: curl -I https://$DOMAIN --max-time $TIMEOUT"
    
    http_output=$(curl -I "https://$DOMAIN" --max-time "$TIMEOUT" -s -w "\n\nHTTP_CODE:%{http_code}\nTIME_TOTAL:%{time_total}\n")
    
    if [ $? -eq 0 ]; then
        local http_code=$(echo "$http_output" | grep "HTTP_CODE:" | cut -d: -f2)
        local time_total=$(echo "$http_output" | grep "TIME_TOTAL:" | cut -d: -f2)
        
        if [ "$http_code" = "200" ]; then
            print_success "HTTP Status: 200 OK"
            print_success "Tiempo de respuesta: ${time_total}s"
            
            # Verificar headers importantes
            if echo "$http_output" | grep -qi "x-azure-ref"; then
                print_success "Azure Front Door header presente (x-azure-ref)"
            fi
            
            if echo "$http_output" | grep -qi "content-type"; then
                local content_type=$(echo "$http_output" | grep -i "content-type" | cut -d: -f2- | tr -d '\r' | xargs)
                print_success "Content-Type: $content_type"
            fi
            
            status="PASS"
            message="HTTPS responde correctamente"
            details="HTTP 200, tiempo: ${time_total}s"
        else
            message="HTTP Status inesperado: $http_code"
            print_error "$message"
            details="HTTP $http_code"
        fi
    else
        message="No se pudo conectar via HTTPS"
        print_error "$message"
        print_error "Posibles causas: Front Door caído, SSL inválido, timeout"
    fi
    
    if [ "$VERBOSE" = true ] && [ "$JSON_OUTPUT" = false ]; then
        echo ""
        echo "Headers completos:"
        echo "$http_output" | head -20
    fi
    
    record_result "$test_name" "$status" "$message" "$details"
    echo ""
}

#############################################################################
# TEST 3: HTTP to HTTPS Redirect
#############################################################################
test_http_redirect() {
    print_test_header "3/5" "HTTP → HTTPS Redirect"
    
    local test_name="http_redirect"
    local http_output
    local status="FAIL"
    local message=""
    local details=""
    
    print_info "Ejecutando: curl -I http://$DOMAIN --max-time $TIMEOUT"
    
    http_output=$(curl -I "http://$DOMAIN" --max-time "$TIMEOUT" -s -w "\nHTTP_CODE:%{http_code}\n")
    
    if [ $? -eq 0 ]; then
        local http_code=$(echo "$http_output" | grep "HTTP_CODE:" | cut -d: -f2)
        
        if [ "$http_code" = "307" ] || [ "$http_code" = "301" ] || [ "$http_code" = "302" ]; then
            print_success "Redirect detectado: HTTP $http_code"
            
            # Verificar que redirige a HTTPS
            if echo "$http_output" | grep -i "location" | grep -q "https://$DOMAIN"; then
                print_success "Redirige correctamente a HTTPS"
                status="PASS"
                message="HTTP redirige correctamente a HTTPS"
                details="HTTP $http_code → HTTPS"
            else
                message="Redirige pero no a HTTPS del dominio correcto"
                print_warning "$message"
            fi
        else
            message="No hay redirect HTTP → HTTPS (código: $http_code)"
            print_error "$message"
            print_warning "Esto podría ser un problema de seguridad"
        fi
    else
        message="No se pudo conectar via HTTP"
        print_error "$message"
    fi
    
    if [ "$VERBOSE" = true ] && [ "$JSON_OUTPUT" = false ]; then
        echo ""
        echo "Headers de redirect:"
        echo "$http_output" | grep -i "location"
    fi
    
    record_result "$test_name" "$status" "$message" "$details"
    echo ""
}

#############################################################################
# TEST 4: SSL Certificate Validation
#############################################################################
test_ssl_cert() {
    print_test_header "4/5" "SSL Certificate Validation"
    
    local test_name="ssl_certificate"
    local cert_output
    local status="FAIL"
    local message=""
    local details=""
    
    print_info "Ejecutando: openssl s_client -servername $DOMAIN -connect $DOMAIN:443"
    
    cert_output=$(echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:443" 2>/dev/null | openssl x509 -noout -dates -subject -issuer 2>/dev/null)
    
    if [ $? -eq 0 ] && [ -n "$cert_output" ]; then
        # Extraer información del certificado
        local subject=$(echo "$cert_output" | grep "subject" | cut -d= -f2-)
        local issuer=$(echo "$cert_output" | grep "issuer" | cut -d= -f2-)
        local not_after=$(echo "$cert_output" | grep "notAfter" | cut -d= -f2-)
        
        print_success "Certificado SSL válido"
        print_info "Subject: $subject"
        print_info "Issuer: $issuer"
        print_success "Expira: $not_after"
        
        # Verificar que el subject contiene el CN esperado
        if echo "$subject" | grep -q "$EXPECTED_CERT_CN"; then
            print_success "CN correcto: $EXPECTED_CERT_CN"
            
            # Verificar que no está expirado (fecha en el futuro)
            local expiry_epoch=$(date -d "$not_after" +%s 2>/dev/null || date -j -f "%b %d %H:%M:%S %Y %Z" "$not_after" +%s 2>/dev/null)
            local current_epoch=$(date +%s)
            
            if [ -n "$expiry_epoch" ] && [ "$expiry_epoch" -gt "$current_epoch" ]; then
                local days_until_expiry=$(( (expiry_epoch - current_epoch) / 86400 ))
                print_success "Certificado válido por $days_until_expiry días más"
                
                if [ "$days_until_expiry" -lt 30 ]; then
                    print_warning "⚠️  Certificado expira en menos de 30 días - considerar renovación"
                fi
                
                status="PASS"
                message="Certificado SSL válido y no expirado"
                details="Expira: $not_after ($days_until_expiry días)"
            else
                message="Certificado expirado o fecha inválida"
                print_error "$message"
            fi
        else
            message="CN del certificado no coincide con el esperado"
            print_error "$message"
            print_error "Esperado: $EXPECTED_CERT_CN"
        fi
    else
        message="No se pudo obtener certificado SSL"
        print_error "$message"
    fi
    
    record_result "$test_name" "$status" "$message" "$details"
    echo ""
}

#############################################################################
# TEST 5: Application Response
#############################################################################
test_app_response() {
    print_test_header "5/5" "Application Response (Next.js)"
    
    local test_name="application_response"
    local app_output
    local status="FAIL"
    local message=""
    local details=""
    
    print_info "Ejecutando: curl -s https://$DOMAIN --max-time $TIMEOUT"
    
    app_output=$(curl -s "https://$DOMAIN" --max-time "$TIMEOUT")
    
    if [ $? -eq 0 ] && [ -n "$app_output" ]; then
        local content_length=${#app_output}
        print_success "Recibido contenido HTML ($content_length bytes)"
        
        # Verificar que contiene elementos esperados de la app SUANET
        local checks_passed=0
        
        if echo "$app_output" | grep -qi "suanet"; then
            print_success "✓ Encontrado: 'Suanet' en el HTML"
            ((checks_passed++))
        fi
        
        if echo "$app_output" | grep -qi "<title>"; then
            local title=$(echo "$app_output" | grep -i "<title>" | sed 's/<[^>]*>//g' | xargs)
            print_success "✓ Title tag: $title"
            ((checks_passed++))
        fi
        
        if echo "$app_output" | grep -qi "next"; then
            print_success "✓ Detectado Next.js (framework presente)"
            ((checks_passed++))
        fi
        
        if echo "$app_output" | grep -qi "<!DOCTYPE html>"; then
            print_success "✓ HTML válido (DOCTYPE presente)"
            ((checks_passed++))
        fi
        
        if [ $checks_passed -ge 2 ]; then
            status="PASS"
            message="Aplicación respondiendo correctamente"
            details="HTML válido, $checks_passed/4 checks pasaron, ${content_length} bytes"
        else
            message="HTML recibido pero contenido inesperado"
            print_warning "$message"
            details="Solo $checks_passed/4 checks pasaron"
        fi
    else
        message="No se recibió respuesta de la aplicación"
        print_error "$message"
    fi
    
    if [ "$VERBOSE" = true ] && [ "$JSON_OUTPUT" = false ]; then
        echo ""
        echo "Primeras 20 líneas del HTML:"
        echo "$app_output" | head -20
    fi
    
    record_result "$test_name" "$status" "$message" "$details"
    echo ""
}

#############################################################################
# Generar reporte final
#############################################################################
generate_report() {
    local end_time=$(date +%s)
    local duration=$((end_time - START_TIME))
    
    if [ "$JSON_OUTPUT" = true ]; then
        # Output JSON
        echo "{"
        echo "  \"timestamp\": \"$TIMESTAMP\","
        echo "  \"domain\": \"$DOMAIN\","
        echo "  \"duration_seconds\": $duration,"
        echo "  \"tests_passed\": $TESTS_PASSED,"
        echo "  \"tests_failed\": $TESTS_FAILED,"
        echo "  \"tests_total\": $((TESTS_PASSED + TESTS_FAILED)),"
        echo "  \"overall_status\": \"$([ $TESTS_FAILED -eq 0 ] && echo 'HEALTHY' || echo 'DEGRADED')\","
        echo "  \"results\": ["
        
        local first=true
        for result in "${TEST_RESULTS[@]}"; do
            if [ "$first" = true ]; then
                first=false
            else
                echo ","
            fi
            echo "    $result"
        done
        
        echo ""
        echo "  ]"
        echo "}"
    else
        # Output humano
        echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${BOLD}REPORTE FINAL${NC}"
        echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo ""
        echo -e "${CYAN}Duración:${NC} ${duration}s"
        echo -e "${CYAN}Tests ejecutados:${NC} $((TESTS_PASSED + TESTS_FAILED))"
        echo -e "${GREEN}Tests pasados:${NC} $TESTS_PASSED"
        echo -e "${RED}Tests fallidos:${NC} $TESTS_FAILED"
        echo ""
        
        if [ $TESTS_FAILED -eq 0 ]; then
            echo -e "${GREEN}${BOLD}╔════════════════════════════════════════════╗${NC}"
            echo -e "${GREEN}${BOLD}║  ✓ SISTEMA OPERATIVO AL 100%              ║${NC}"
            echo -e "${GREEN}${BOLD}╚════════════════════════════════════════════╝${NC}"
            echo ""
            echo -e "${GREEN}Todos los tests pasaron exitosamente.${NC}"
            echo -e "${GREEN}SUANET está funcionando correctamente.${NC}"
        else
            echo -e "${RED}${BOLD}╔════════════════════════════════════════════╗${NC}"
            echo -e "${RED}${BOLD}║  ✗ SISTEMA REQUIERE ATENCIÓN              ║${NC}"
            echo -e "${RED}${BOLD}╚════════════════════════════════════════════╝${NC}"
            echo ""
            echo -e "${YELLOW}Se detectaron problemas que requieren diagnóstico.${NC}"
            echo -e "${YELLOW}Ejecutar diagnóstico completo:${NC}"
            echo ""
            echo -e "  ${CYAN}Ver documentación:${NC}"
            echo -e "  /home/lballesterosp/ALL/SUANET-FRONTEND/docs/PRODUCTION_TESTING_PROTOCOL.md"
            echo ""
            echo -e "  ${CYAN}O seguir el diagnóstico paso a paso en la sección:${NC}"
            echo -e "  'Diagnóstico Completo Paso a Paso'"
        fi
        echo ""
    fi
}

#############################################################################
# Función de ayuda
#############################################################################
show_help() {
    cat << HELP
SUANET Production Health Check - Test de 5 Minutos

Script automatizado para verificar el estado de SUANET en producción.
Ejecuta 5 tests críticos y genera un reporte detallado.

USO:
    $0 [OPTIONS]

OPCIONES:
    --verbose       Mostrar output detallado de cada comando
    --json          Generar output en formato JSON para parsing automatizado
    --help          Mostrar esta ayuda

TESTS EJECUTADOS:
    1. DNS Resolution         - Verifica que el dominio resuelve a Front Door
    2. HTTPS Connectivity     - Verifica que HTTPS responde con 200 OK
    3. HTTP → HTTPS Redirect  - Verifica redirect de seguridad
    4. SSL Certificate        - Valida certificado y fecha de expiración
    5. Application Response   - Verifica que Next.js está respondiendo

EXIT CODES:
    0   Todos los tests pasaron (sistema operativo al 100%)
    1   Al menos un test falló (requiere diagnóstico)
    2   Error en el script (parámetros inválidos, etc.)

EJEMPLOS:
    # Ejecución básica
    $0

    # Con output detallado
    $0 --verbose

    # Generar JSON para CI/CD
    $0 --json

    # Guardar resultado en archivo
    $0 --verbose > health-check-\$(date +%Y%m%d-%H%M%S).log

DOCUMENTACIÓN COMPLETA:
    /home/lballesterosp/ALL/SUANET-FRONTEND/docs/PRODUCTION_TESTING_PROTOCOL.md

HELP
}

#############################################################################
# Main
#############################################################################
main() {
    # Parsear argumentos
    while [[ $# -gt 0 ]]; do
        case $1 in
            --verbose)
                VERBOSE=true
                shift
                ;;
            --json)
                JSON_OUTPUT=true
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                echo "Argumento desconocido: $1"
                echo "Usa --help para ver opciones disponibles"
                exit 2
                ;;
        esac
    done
    
    # Verificar dependencias
    for cmd in curl nslookup openssl date; do
        if ! command -v $cmd &> /dev/null; then
            echo "Error: Comando '$cmd' no encontrado. Por favor instálalo primero."
            exit 2
        fi
    done
    
    # Ejecutar tests
    print_header
    test_dns
    test_https
    test_http_redirect
    test_ssl_cert
    test_app_response
    
    # Generar reporte
    generate_report
    
    # Exit code basado en resultados
    if [ $TESTS_FAILED -eq 0 ]; then
        exit 0
    else
        exit 1
    fi
}

# Ejecutar
main "$@"
