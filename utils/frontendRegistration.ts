// Utilidad para registrar el frontend con el backend
export interface FrontendRegistrationResult {
  success: boolean;
  message: string;
  data?: {
    registeredUrl: string;
    activeFrontends: string[];
    timestamp: string;
  };
}

export interface ClientInfo {
  userAgent: string;
  platform: string;
  language: string;
  timestamp: string;
  buildVersion?: string;
  environment: string; // 'production' o 'development'
}

export class FrontendRegistration {
  private static instance: FrontendRegistration;
  private isRegistered = false;
  private registrationRetryCount = 0;
  private maxRetries = 5; // Aumentado para mayor confiabilidad
  private registrationPromise: Promise<FrontendRegistrationResult> | null = null;
  private sessionId: string; // ✅ NUEVO: Identificador único de sesión

  private constructor() {
    // ✅ NUEVO: Generar ID único para esta instancia de frontend
    this.sessionId = `frontend-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  public static getInstance(): FrontendRegistration {
    if (!FrontendRegistration.instance) {
      FrontendRegistration.instance = new FrontendRegistration();
    }
    return FrontendRegistration.instance;
  }

  /**
   * Obtiene la URL actual del frontend con prioridad consistente
   * ✅ CORRIGIDO: Usar siempre NEXT_PUBLIC_FRONTEND_URL para consistencia
   */
  private getFrontendUrl(): string {
    // ✅ CRÍTICO: Usar siempre la variable de entorno para consistencia
    // Esto evita conflictos entre server.js y client-side registration
    const envUrl = process.env.NEXT_PUBLIC_FRONTEND_URL;
    
    if (envUrl) {
      console.log(`🔍 [Registration] Using NEXT_PUBLIC_FRONTEND_URL: ${envUrl}`);
      return envUrl;
    }
    
    // Fallback solo si no hay variable de entorno
    if (typeof window === 'undefined') {
      // Server-side fallback
      const fallback = 'http://localhost:3000';
      console.warn(`⚠️ [Registration] NEXT_PUBLIC_FRONTEND_URL not set, using fallback: ${fallback}`);
      return fallback;
    }
    
    // Client-side fallback (solo si no hay variable de entorno)
    const clientUrl = `${window.location.protocol}//${window.location.host}`;
    console.warn(`⚠️ [Registration] NEXT_PUBLIC_FRONTEND_URL not set, using client URL: ${clientUrl}`);
    return clientUrl;
  }

  /**
   * Obtiene información del cliente
   */
  private getClientInfo(): ClientInfo {
    // Determinar environment basado en variables disponibles
    let environment: 'development' | 'production' | 'staging' = 'development';
    
    if (process.env.NODE_ENV === 'production') {
      environment = 'production';
    } else if (process.env.NEXT_PUBLIC_ENVIRONMENT === 'staging') {
      environment = 'staging';
    }

    if (typeof window === 'undefined') {
      return {
        userAgent: 'Server-Side-Registration',
        platform: 'Node.js',
        language: 'en',
        timestamp: new Date().toISOString(),
        environment,
        buildVersion: process.env.NEXT_PUBLIC_BUILD_VERSION || 'unknown'
      };
    }

    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      timestamp: new Date().toISOString(),
      environment,
      buildVersion: process.env.NEXT_PUBLIC_BUILD_VERSION || 'unknown'
    };
  }

  /**
   * Registra el frontend con el backend
   * ✅ CRÍTICO: Esta función debe completarse ANTES de cualquier OAuth
   */
  public async register(): Promise<FrontendRegistrationResult> {
    // ✅ NUEVO: Evitar registros simultáneos
    if (this.registrationPromise) {
      console.log('🔄 Registro ya en progreso, esperando...');
      return this.registrationPromise;
    }

    if (this.isRegistered) {
      console.log('✅ Frontend ya está registrado');
      return {
        success: true,
        message: 'Frontend ya registrado'
      };
    }

    // ✅ NUEVO: Crear promesa para evitar registros simultáneos
    this.registrationPromise = this._performRegistration();
    
    try {
      const result = await this.registrationPromise;
      return result;
    } finally {
      this.registrationPromise = null;
    }
  }

  private async _performRegistration(): Promise<FrontendRegistrationResult> {
    const frontendUrl = this.getFrontendUrl();
    const clientInfo = this.getClientInfo();
    
    // ✅ CORREGIDO: Usar la URL base (el proxy del frontend se encarga de /api)
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';

    console.log(`🔍 [Debug] Frontend URL: ${frontendUrl}`);
    console.log(`🔍 [Debug] Backend URL (via proxy): ${backendUrl}`);
    console.log(`🔍 [Debug] Environment: ${clientInfo.environment}`);

    console.log(`🌐 CRÍTICO: Registrando ${frontendUrl} con ${backendUrl} (via proxy /api)`);

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        console.log(`📡 Intento ${attempt + 1}/${this.maxRetries} de registro de frontend`);

        // ✅ CORREGIDO: La petición va a /api/register-frontend y el proxy la redirige
        const response = await fetch(`${backendUrl}/api/register-frontend`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            frontendUrl,
            sessionId: this.sessionId, // ✅ NUEVO: Incluir ID de sesión
            clientInfo: {
              ...clientInfo,
              registrationPurpose: 'OAuth callback URL configuration',
              priority: 'CRITICAL',
              sessionId: this.sessionId // ✅ NUEVO: También en clientInfo
            }
          }),
          signal: AbortSignal.timeout(30000), // 30 segundos para producción
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result: FrontendRegistrationResult = await response.json();
        
        if (result.success) {
          this.isRegistered = true;
          this.registrationRetryCount = 0;
          console.log('✅ CRÍTICO: Frontend registrado exitosamente para OAuth (via proxy)');
          console.log('📍 Backend conoce URL:', result.data?.registeredUrl);
          console.log('🔑 Session ID:', this.sessionId);
          console.log('📋 Active frontends:', result.data?.activeFrontends);
          
          // ✅ NUEVO: Programar re-registro periódico pero menos frecuente
          this.schedulePeriodicRegistration();
          
          return result;
        } else {
          throw new Error(result.message || 'Registration failed');
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
        console.error(`❌ Intento ${attempt + 1} falló:`, errorMessage);
        
        // ✅ NUEVO: Si es el último intento, devolver error
        if (attempt === this.maxRetries - 1) {
          console.error('❌ CRÍTICO: No se pudo registrar frontend después de todos los intentos');
          console.error('❌ OAuth callbacks fallarán por URL incorrecta');
          
          return {
            success: false,
            message: `Registro falló después de ${this.maxRetries} intentos: ${errorMessage}`
          };
        }

        // ✅ NUEVO: Backoff exponencial
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
        console.log(`⏳ Esperando ${delay}ms antes del siguiente intento...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return {
      success: false,
      message: 'Registro falló - límite de reintentos alcanzado'
    };
  }

  /**
   * Programa registro periódico para mantener la conexión activa
   * ✅ MODIFICADO: Menos frecuente para reducir overhead
   */
  private schedulePeriodicRegistration(): void {
    // Re-registrar cada 10 minutos (menos frecuente)
    setInterval(() => {
      console.log('🔄 Re-registro periódico del frontend...');
      this.isRegistered = false; // Forzar nuevo registro
      this.register().catch(error => {
        console.warn('⚠️ Error en re-registro periódico:', error);
      });
    }, 10 * 60 * 1000); // 10 minutos
  }

  /**
   * Obtiene información del frontend registrado desde el backend
   */
  public async getFrontendInfo(): Promise<any> {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';
    
    try {
     const response = await fetch(`${backendUrl}/api/frontend-info`);
     if (!response.ok) {
       throw new Error(`HTTP ${response.status}: ${response.statusText}`);
     }
     return await response.json();
   } catch (error) {
     console.error('Error al obtener información del frontend:', error);
     throw error;
   }
 }

 /**
  * Obtiene el estado actual del registro
  */
 public getRegistrationStatus(): boolean {
   return this.isRegistered;
 }

 /**
  * Resetea el estado de registro (para testing)
  */
 public resetRegistration(): void {
   this.isRegistered = false;
   this.registrationRetryCount = 0;
   this.registrationPromise = null;
 }
}

// Exportar instancia singleton
export const frontendRegistration = FrontendRegistration.getInstance();
