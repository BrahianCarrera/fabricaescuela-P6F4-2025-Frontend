import { API_CONFIG } from "./config";
import { AuthService } from "./auth";

/**
 * Cliente HTTP para hacer peticiones autenticadas al servicio de inventario
 */
export class ApiClient {
  private baseURL: string;

  constructor(baseURL: string = API_CONFIG.INVENTORY_BASE_URL) {
    this.baseURL = baseURL;
  }

  /**
   * Realizar una petición autenticada
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = AuthService.getAccessToken();

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    // Agregar token de autenticación si está disponible
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const url = endpoint.startsWith("http") 
      ? endpoint 
      : `${this.baseURL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Si el token expiró, intentar renovarlo
    if (response.status === 401) {
      const newToken = await AuthService.refreshAccessToken();
      
      if (newToken) {
        // Reintentar la petición con el nuevo token
        headers["Authorization"] = `Bearer ${newToken}`;
        const retryResponse = await fetch(url, {
          ...options,
          headers,
        });

        if (!retryResponse.ok) {
          throw new Error(`Error ${retryResponse.status}: ${retryResponse.statusText}`);
        }

        return retryResponse.json();
      } else {
        // Si no se pudo renovar, redirigir al login
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
        throw new Error("Sesión expirada. Por favor, inicia sesión nuevamente.");
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error ${response.status}: ${errorText || response.statusText}`);
    }

    // Si la respuesta no tiene contenido, retornar null
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      return null as T;
    }

    return response.json();
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "GET",
    });
  }

  /**
   * POST request
   */
  async post<T>(endpoint: string, data?: any, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * PUT request
   */
  async put<T>(endpoint: string, data?: any, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "DELETE",
    });
  }
}

/**
 * Instancia singleton del cliente API
 */
export const apiClient = new ApiClient();

/**
 * Servicios específicos para los endpoints de paquetes
 */
export const packageService = {
  /**
   * Obtener todos los paquetes
   */
  getAll: () => apiClient.get<any[]>("/paquetes"),

  /**
   * Obtener un paquete por código
   */
  getByCode: (codigo: string) => apiClient.get<any>(`/paquetes/${codigo}`),

  /**
   * Obtener paquetes en ruta
   */
  getEnRuta: (codigo?: string) => {
    if (codigo) {
      return apiClient.get<any>(`/paquetes/en-ruta/${codigo}`);
    }
    return apiClient.get<any[]>("/paquetes/en-ruta");
  },

  /**
   * Actualizar dirección de un paquete en ruta
   */
  updateDireccion: (codigo: string, data: {
    direccion?: string;
    destinatario?: string;
  }) => apiClient.put<any>(`/paquetes/en-ruta/${codigo}/direccion`, data),

  /**
   * Registrar nueva ubicación
   */
  registrarUbicacion: (codigoPaquete: string, data: {
    ubicacion: string;
    latitud?: number;
    longitud?: number;
  }) => apiClient.post<any>(`/paquetes/${codigoPaquete}/ubicaciones`, data),

  /**
   * Obtener historial de ubicaciones
   */
  getUbicaciones: (codigoPaquete: string) => 
    apiClient.get<any[]>(`/paquetes/${codigoPaquete}/ubicaciones`),

  /**
   * Obtener última ubicación
   */
  getUltimaUbicacion: (codigoPaquete: string) =>
    apiClient.get<any>(`/paquetes/${codigoPaquete}/ubicaciones/ultima`),
};

/**
 * Servicio para novedades
 */
export const novedadService = {
  /**
   * Obtener todas las novedades
   */
  getAll: () => apiClient.get<any[]>("/novedades"),

  /**
   * Crear una novedad
   */
  create: (data: {
    codigoPaquete: string;
    descripcion: string;
    tipo?: string;
  }) => apiClient.post<any>("/novedades", data),

  /**
   * Obtener novedades de un paquete
   */
  getByPaquete: (codigoPaquete: string) =>
    apiClient.get<any[]>(`/novedades?paquete=${codigoPaquete}`),
};

